import axios from 'axios';
import config from '../config/config.js';
import logger from '../utils/logger.js';

export class PolymarketClient {
  constructor() {
    this.baseURL = config.POLYMARKET_CLOB_URL;
    this.privateKey = config.POLYMARKET_PRIVATE_KEY;
    this.walletAddress = config.POLYMARKET_WALLET_ADDRESS;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Polymarket API request', {
          method: config.method,
          url: config.url,
          data: config.data ? { ...config.data, privateKey: '***' } : undefined
        });
        return config;
      },
      (error) => {
        logger.error('Polymarket API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Polymarket API response', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('Polymarket API response error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  // get market orderbook
  async getOrderbook(tokenId) {
    try {
      const response = await this.client.get(`/book`, {
        params: { token_id: tokenId }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get orderbook', { tokenId, error: error.message });
      throw error;
    }
  }

  // get market pricing information
  async getPricing(tokenId) {
    try {
      const response = await this.client.get(`/pricing`, {
        params: { token_id: tokenId }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get pricing', { tokenId, error: error.message });
      throw error;
    }
  }

  // search for markets by query
  async searchMarkets(query) {
    try {
      const response = await this.client.get(`/markets`, {
        params: { 
          search: query,
          limit: 50,
          sort: 'volume'
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to search markets', { query, error: error.message });
      throw error;
    }
  }

  // get specific market details
  async getMarket(marketId) {
    try {
      const response = await this.client.get(`/markets/${marketId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get market', { marketId, error: error.message });
      throw error;
    }
  }

  // place a single order
  async placeOrder(orderData) {
    try {
      const orderPayload = {
        ...orderData,
        maker: this.walletAddress,
        private_key: this.privateKey
      };

      logger.info('Placing order', {
        token_id: orderPayload.token_id,
        side: orderPayload.side,
        amount: orderPayload.amount,
        price: orderPayload.price
      });

      const response = await this.client.post('/orders', orderPayload);
      return response.data;
    } catch (error) {
      logger.error('Failed to place order', { 
        orderData: { ...orderData, private_key: '***' },
        error: error.message 
      });
      throw error;
    }
  }

  // place multiple orders (batching)
  async placeMultipleOrders(orders) {
    try {
      const ordersPayload = orders.map(order => ({
        ...order,
        maker: this.walletAddress,
        private_key: this.privateKey
      }));

      logger.info('Placing multiple orders', { count: orders.length });

      const response = await this.client.post('/orders/batch', {
        orders: ordersPayload
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to place multiple orders', { 
        ordersCount: orders.length,
        error: error.message 
      });
      throw error;
    }
  }

  // get specific order details
  async getOrder(orderId) {
    try {
      const response = await this.client.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get order', { orderId, error: error.message });
      throw error;
    }
  }

  // get active orders for the wallet
  async getActiveOrders() {
    try {
      const response = await this.client.get('/orders', {
        params: {
          maker: this.walletAddress,
          status: 'active'
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get active orders', { error: error.message });
      throw error;
    }
  }

  // cancel specific order(s)
  async cancelOrder(orderId) {
    try {
      const response = await this.client.delete(`/orders/${orderId}`, {
        data: {
          private_key: this.privateKey
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to cancel order', { orderId, error: error.message });
      throw error;
    }
  }

  // cancel multiple orders
  async cancelMultipleOrders(orderIds) {
    try {
      const response = await this.client.delete('/orders/batch', {
        data: {
          order_ids: orderIds,
          private_key: this.privateKey
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to cancel multiple orders', { orderIds, error: error.message });
      throw error;
    }
  }

  // get trades for a specific market
  async getTrades(tokenId, limit = 100) {
    try {
      const response = await this.client.get('/trades', {
        params: {
          token_id: tokenId,
          limit
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get trades', { tokenId, error: error.message });
      throw error;
    }
  }

  // buy contract (YES side)
  async buyContract(tokenId, amount, price) {
    return this.placeOrder({
      token_id: tokenId,
      side: 'buy',
      amount: amount,
      price: price,
      order_type: 'limit'
    });
  }

  // sell contract (NO side)
  async sellContract(tokenId, amount, price) {
    return this.placeOrder({
      token_id: tokenId,
      side: 'sell',
      amount: amount,
      price: price,
      order_type: 'limit'
    });
  }

  // create a market order to buy
  async marketBuy(tokenId, amount) {
    try {
      // get current orderbook to determine market price
      const orderbook = await this.getOrderbook(tokenId);
      const bestAsk = orderbook.asks?.[0];
      
      if (!bestAsk) {
        throw new Error('No asks available for market buy');
      }

      return this.placeOrder({
        token_id: tokenId,
        side: 'buy',
        amount: amount,
        price: bestAsk.price,
        order_type: 'market'
      });
    } catch (error) {
      logger.error('Failed to execute market buy', { tokenId, amount, error: error.message });
      throw error;
    }
  }

  // create a market order to sell
  async marketSell(tokenId, amount) {
    try {
      // get current orderbook to determine market price
      const orderbook = await this.getOrderbook(tokenId);
      const bestBid = orderbook.bids?.[0];
      
      if (!bestBid) {
        throw new Error('No bids available for market sell');
      }

      return this.placeOrder({
        token_id: tokenId,
        side: 'sell',
        amount: amount,
        price: bestBid.price,
        order_type: 'market'
      });
    } catch (error) {
      logger.error('Failed to execute market sell', { tokenId, amount, error: error.message });
      throw error;
    }
  }

  // get wallet balance and positions
  async getWalletInfo() {
    try {
      const response = await this.client.get('/wallet/info', {
        params: { address: this.walletAddress }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get wallet info', { error: error.message });
      throw error;
    }
  }

  // get current positions for a specific token
  async getPosition(tokenId) {
    try {
      const walletInfo = await this.getWalletInfo();
      const position = walletInfo.positions?.find(p => p.token_id === tokenId);
      return position || null;
    } catch (error) {
      logger.error('Failed to get position', { tokenId, error: error.message });
      throw error;
    }
  }
}

export default PolymarketClient;
