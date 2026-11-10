import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import promClient from 'prom-client';

import { createLogger } from '@shared/utils';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { routes } from './routes';
import { healthController } from './controllers/health';
import { metricsController } from './controllers/health';

const logger = createLogger('api-gateway');

const app: Application = express();
const PORT = Number(process.env.GATEWAY_PORT || 3000);
const HOST = process.env.GATEWAY_HOST || '0.0.0.0';

// Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'gateway_' });

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Request ID middleware
app.use((req, res, next) => {
  const requestWithId = req as typeof req & { id: string };
  requestWithId.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', requestWithId.id);
  next();
});

// Health check endpoint
app.get('/health', healthController);

// Metrics endpoint
app.get('/metrics', metricsController);

// API routes
app.use('/api/auth', routes.auth);
app.use('/api/users', authMiddleware, routes.users);
app.use('/api/products', routes.products);
app.use('/api/orders', authMiddleware, routes.orders);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start server
app.listen(PORT, HOST, () => {
  logger.info(`🚀 API Gateway running on http://${HOST}:${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
