import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userRepository, User, CreateUserDTO } from '../repositories/user.repository';
import { NotFoundError, ConflictError, UnauthorizedError } from '@shared/utils';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];
const SALT_ROUNDS = 10;

export interface RegisterDTO {
  email: string;
  name: string;
  password: string;
  role?: 'user' | 'admin';
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
  refreshToken: string;
}

export const userService = {
  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user
    const user = await userRepository.create({
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role || 'user',
    });

    // Generate tokens
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
      refreshToken,
    };
  },

  async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user by email
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
      refreshToken,
    };
  },

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as {
        id: string;
        type: 'refresh';
      };

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type');
      }

      const user = await userRepository.findById(decoded.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }
      throw error;
    }
  },

  async getUserById(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.sanitizeUser(user);
  },

  async updateUser(id: string, data: Partial<RegisterDTO>): Promise<Omit<User, 'passwordHash'>> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updateData: any = {};

    if (data.email) {
      // Check if new email is already taken
      const existingUser = await userRepository.findByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictError('User with this email already exists');
      }
      updateData.email = data.email;
    }

    if (data.name) {
      updateData.name = data.name;
    }

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    const updatedUser = await userRepository.update(id, updateData);
    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }

    return this.sanitizeUser(updatedUser);
  },

  async deleteUser(id: string): Promise<void> {
    const deleted = await userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('User not found');
    }
  },

  generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  },

  generateRefreshToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        type: 'refresh',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  },

  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  },
};
