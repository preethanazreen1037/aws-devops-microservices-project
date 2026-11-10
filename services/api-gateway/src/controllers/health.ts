import { Request, Response } from 'express';
import { ServiceHealth } from '@shared/utils';
import axios from 'axios';

const SERVICE_URLS = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  product: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
};

export const healthController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const health: ServiceHealth & { checks: Record<string, boolean> } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    version: '1.0.0',
    checks: {},
  };

  // Check downstream services
  const services = ['user', 'product', 'order'];
  
  for (const service of services) {
    try {
      const response = await axios.get(`${SERVICE_URLS[service as keyof typeof SERVICE_URLS]}/health`, {
        timeout: 5000,
      });
      health.checks[service] = response.data.status === 'healthy';
    } catch (error) {
      health.checks[service] = false;
      health.status = 'degraded';
    }
  }

  // If all services are unhealthy, mark as unhealthy
  const allUnhealthy = Object.values(health.checks).every((check) => !check);
  if (allUnhealthy) {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
};

export const metricsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const promClient = await import('prom-client');
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
};
