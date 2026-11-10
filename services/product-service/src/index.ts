import express, { Application } from 'express';
import morgan from 'morgan';
import promClient from 'prom-client';

import { createLogger } from '@shared/utils';
import { errorHandler } from './middleware/errorHandler';
import { productRoutes } from './routes/product.routes';
import { healthController } from './controllers/health.controller';
import { metricsController } from './controllers/health.controller';
import { pool } from './database';

const logger = createLogger('product-service');

const app: Application = express();
const PORT = Number(process.env.PRODUCT_SERVICE_PORT || 3002);
const HOST = process.env.PRODUCT_SERVICE_HOST || '0.0.0.0';

// Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'product_service_' });

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Health check endpoint
app.get('/health', healthController);

// Metrics endpoint
app.get('/metrics', metricsController);

// API routes
app.use('/products', productRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handling middleware
app.use(errorHandler);

// Database connection test
pool.on('connect', () => {
  logger.info('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(PORT, HOST, () => {
  logger.info(`🚀 Product Service running on http://${HOST}:${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
