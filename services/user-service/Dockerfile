# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=packages/shared

# Copy shared package
COPY packages/shared ./packages/shared

# Copy service files
COPY services/user-service/package*.json ./services/user-service/
COPY services/user-service/tsconfig.json ./services/user-service/
COPY services/user-service/src ./services/user-service/src

WORKDIR /app/services/user-service

RUN npm install
RUN cd /app && npm run build --workspace=packages/shared
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/

RUN npm install --production --workspace=packages/shared

COPY packages/shared ./packages/shared
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist

COPY services/user-service/package*.json ./services/user-service/
COPY services/user-service/tsconfig.json ./services/user-service/

WORKDIR /app/services/user-service

RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/services/user-service/dist ./dist

# Create logs directory
RUN mkdir -p /app/services/user-service/logs && chown -R node:node /app/services/user-service/logs

EXPOSE 3001

USER node

CMD ["node", "dist/index.js"]
