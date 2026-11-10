import axios from 'axios';
import { orderRepository, Order, CreateOrderDTO, ShippingAddress } from '../repositories/order.repository';
import { NotFoundError, BadRequestError, ServiceUnavailableError } from '@shared/utils';
import { createLogger } from '@shared/utils';

const logger = createLogger('order-service:order');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  userId: string;
  items: OrderItemInput[];
  shippingAddress: ShippingAddress;
}

export const orderService = {
  async getAllOrders(params: { userId?: string; page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 10 } = params;
    
    if (page < 1) {
      throw new BadRequestError('Page must be >= 1');
    }
    if (limit < 1 || limit > 100) {
      throw new BadRequestError('Limit must be between 1 and 100');
    }

    return await orderRepository.findAll(params);
  },

  async getOrderById(id: string): Promise<Order> {
    const order = await orderRepository.findById(id);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return order;
  },

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return await orderRepository.findByUserId(userId);
  },

  async createOrder(data: CreateOrderInput): Promise<Order> {
    // Validate items
    if (!data.items || data.items.length === 0) {
      throw new BadRequestError('Order must have at least one item');
    }

    // Fetch product details and validate stock
    const productsWithDetails = await this.fetchProductDetails(data.items);
    
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = productsWithDetails.map(({ product, quantity }) => {
      const itemTotal = product.price * quantity;
      totalAmount += itemTotal;
      return {
        productId: product.id,
        quantity,
        price: product.price,
      };
    });

    // Create order
    const order = await orderRepository.create({
      userId: data.userId,
      items: orderItems,
      totalAmount,
      shippingAddress: data.shippingAddress,
    });

    // Update product stock (in background)
    this.updateProductStock(data.items).catch((err) => {
      logger.error('Failed to update product stock', { error: err.message, orderId: order.id });
    });

    logger.info('Order created', { orderId: order.id, userId: data.userId, totalAmount });

    return order;
  },

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    // Check if order exists
    const existingOrder = await orderRepository.findById(id);
    if (!existingOrder) {
      throw new NotFoundError('Order not found');
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[existingOrder.status].includes(status)) {
      throw new BadRequestError(
        `Cannot transition order from ${existingOrder.status} to ${status}`
      );
    }

    const order = await orderRepository.updateStatus(id, status);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    logger.info('Order status updated', { orderId: id, status });

    return order;
  },

  async cancelOrder(id: string): Promise<Order> {
    const order = await orderRepository.cancel(id);
    if (!order) {
      throw new BadRequestError('Order cannot be cancelled (already shipped or delivered)');
    }

    logger.info('Order cancelled', { orderId: id });

    return order;
  },

  async deleteOrder(id: string): Promise<void> {
    const deleted = await orderRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Order not found');
    }
  },

  async fetchProductDetails(items: OrderItemInput[]) {
    const productsWithDetails: { product: any; quantity: number }[] = [];

    for (const item of items) {
      try {
        const response = await axios.get(`${PRODUCT_SERVICE_URL}/products/${item.productId}`);
        const product = response.data.data;

        if (product.stock < item.quantity) {
          throw new BadRequestError(`Insufficient stock for product: ${product.name}`);
        }

        productsWithDetails.push({ product, quantity: item.quantity });
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw new NotFoundError(`Product not found: ${item.productId}`);
        }
        if (error instanceof BadRequestError) {
          throw error;
        }
        logger.error('Failed to fetch product', { productId: item.productId, error: error.message });
        throw new ServiceUnavailableError('Product service unavailable');
      }
    }

    return productsWithDetails;
  },

  async updateProductStock(items: OrderItemInput[]) {
    for (const item of items) {
      try {
        await axios.put(`${PRODUCT_SERVICE_URL}/products/${item.productId}/stock`, {
          quantity: item.quantity,
        });
      } catch (error: any) {
        logger.error('Failed to update product stock', { 
          productId: item.productId, 
          error: error.message 
        });
      }
    }
  },
};
