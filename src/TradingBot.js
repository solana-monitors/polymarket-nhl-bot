import BoltOddsClient from './services/BoltOddsClient.js';
import PolymarketClient from './services/PolymarketClient.js';
import OddsComparison from './services/OddsComparison.js';
import config from './config/config.js';
import logger from './utils/logger.js';

export class TradingBot {
  constructor() {
    this.boltOddsClient = new BoltOddsClient();
    this.polymarketClient = new PolymarketClient();
    this.oddsComparison = new OddsComparison();
    
    this.isRunning = false;
    this.activePositions = new Map();
    this.tradingHistory = [];
    this.maxPositionSize = config.MAX_POSITION_SIZE;
    this.autoSellEnabled = config.AUTO_SELL_ENABLED;
    this.autoSellThreshold = config.AUTO_SELL_THRESHOLD;
    
    this.setupEventHandlers();
  }

  // setup event handlers for data feeds
  setupEventHandlers() {
    // boltodds event handlers
    this.boltOddsClient.on('initialState', (data) => {
      this.handleBoltOddsUpdate(data);
    });

    this.boltOddsClient.on('gameUpdate', (data) => {
      this.handleBoltOddsUpdate(data);
    });

    this.boltOddsClient.on('lineUpdate', (data) => {
      this.handleBoltOddsUpdate(data);
    });

    this.boltOddsClient.on('gameAdded', (data) => {
      logger.info('New NHL game added', { game: data.game });
      this.handleBoltOddsUpdate(data);
    });

    this.boltOddsClient.on('gameRemoved', (data) => {
      logger.info('NHL game removed', { game: data.game });
      this.handleGameRemoved(data);
    });

    this.boltOddsClient.on('error', (error) => {
      logger.error('BoltOdds error', { error });
    });

    // polymarket error handling
    this.polymarketClient.on?.('error', (error) => {
      logger.error('Polymarket error', { error });
    });
  }

  // start the trading bot
  async start() {
    try {
      logger.info('Starting NHL Trading Bot...');
      
      // connect to boltodds
      await this.boltOddsClient.connect();
      
      // load existing positions
      await this.loadActivePositions();
      
      // start main trading loop
      this.isRunning = true;
      this.startTradingLoop();
      
      // start periodic cleanup
      this.startPeriodicCleanup();
      
      logger.info('Trading bot started successfully');
      
    } catch (error) {
      logger.error('Failed to start trading bot', { error: error.message });
      throw error;
    }
  }

  // stop the trading bot
  async stop() {
    try {
      logger.info('Stopping trading bot...');
      
      this.isRunning = false;
      
      // close connections
      this.boltOddsClient.close();
      
      // save trading history
      await this.saveTradingHistory();
      
      logger.info('Trading bot stopped');
      
    } catch (error) {
      logger.error('Error stopping trading bot', { error: error.message });
    }
  }

  // handle boltodds data updates
  handleBoltOddsUpdate(data) {
    try {
      // update odds comparison data
      this.oddsComparison.updateBoltOddsData(data);
      
      // check for trading opportunities
      this.checkTradingOpportunities();
      
      // check auto-sell conditions if enabled
      if (this.autoSellEnabled) {
        this.checkAutoSellConditions();
      }
      
    } catch (error) {
      logger.error('Error handling BoltOdds update', { error: error.message, data });
    }
  }

  // handle game removal
  handleGameRemoved(data) {
    try {
      const gameKey = this.oddsComparison.createGameKey(data);
      
      // remove from active positions if any
      for (const [tokenId, position] of this.activePositions.entries()) {
        if (position.gameKey === gameKey) {
          logger.info('Game ended, position remains open', { tokenId, gameKey });
        }
      }
      
    } catch (error) {
      logger.error('Error handling game removal', { error: error.message, data });
    }
  }

  // check for trading opportunities
  checkTradingOpportunities() {
    try {
      const opportunities = this.oddsComparison.findTradingOpportunities();
      
      for (const opportunity of opportunities) {
        this.evaluateOpportunity(opportunity);
      }
      
    } catch (error) {
      logger.error('Error checking trading opportunities', { error: error.message });
    }
  }

  // evaluate a trading opportunity
  async evaluateOpportunity(opportunity) {
    try {
      const { valueAnalysis, recommendation } = opportunity;
      
      // check if we already have a position in this token
      if (this.activePositions.has(recommendation.tokenId)) {
        logger.debug('Already have position in token', { tokenId: recommendation.tokenId });
        return;
      }
      
      // check position size limits
      if (this.getTotalPositionValue() >= this.maxPositionSize) {
        logger.warn('Maximum position size reached', { 
          totalValue: this.getTotalPositionValue(),
          maxSize: this.maxPositionSize
        });
        return;
      }
      
      // execute buy order if confidence is high enough
      if (valueAnalysis.confidence === 'high' || valueAnalysis.confidence === 'medium') {
        await this.executeBuyOrder(opportunity);
      }
      
    } catch (error) {
      logger.error('Error evaluating opportunity', { error: error.message, opportunity });
    }
  }

  // execute a buy order
  async executeBuyOrder(opportunity) {
    try {
      const { valueAnalysis, recommendation, gameInfo } = opportunity;
      const tokenId = recommendation.tokenId;
      
      // calculate position size (simplified - you may want to implement kelly criterion)
      const positionSize = Math.min(
        this.maxPositionSize * 0.1, // 10% of max position per trade
        50 // Maximum $50 per trade
      );
      
      // get current market price
      const orderbook = await this.polymarketClient.getOrderbook(tokenId);
      const bestAsk = orderbook.asks?.[0];
      
      if (!bestAsk) {
        logger.warn('No asks available for buy order', { tokenId });
        return;
      }
      
      // place buy order
      const orderResult = await this.polymarketClient.buyContract(
        tokenId,
        positionSize,
        bestAsk.price
      );
      
      // record the position
      const position = {
        tokenId,
        gameKey: this.oddsComparison.createGameKey(gameInfo),
        gameInfo,
        orderId: orderResult.order_id,
        amount: positionSize,
        price: bestAsk.price,
        buyTime: Date.now(),
        valueAnalysis,
        status: 'open'
      };
      
      this.activePositions.set(tokenId, position);
      
      // record in trading history
      this.tradingHistory.push({
        ...position,
        action: 'buy',
        orderResult
      });
      
      logger.info('Buy order executed', {
        tokenId,
        amount: positionSize,
        price: bestAsk.price,
        expectedValue: valueAnalysis.value,
        confidence: valueAnalysis.confidence
      });
      
    } catch (error) {
      logger.error('Error executing buy order', { error: error.message, opportunity });
    }
  }

  // manual sell functionality
  async sellPosition(tokenId, amount = null) {
    try {
      const position = this.activePositions.get(tokenId);
      
      if (!position) {
        throw new Error(`No active position found for token ${tokenId}`);
      }
      
      const sellAmount = amount || position.amount;
      
      // get current market price
      const orderbook = await this.polymarketClient.getOrderbook(tokenId);
      const bestBid = orderbook.bids?.[0];
      
      if (!bestBid) {
        throw new Error('No bids available for sell order');
      }
      
      // place sell order
      const orderResult = await this.polymarketClient.sellContract(
        tokenId,
        sellAmount,
        bestBid.price
      );
      
      // update position
      position.amount -= sellAmount;
      position.sellPrice = bestBid.price;
      position.sellTime = Date.now();
      
      if (position.amount <= 0) {
        position.status = 'closed';
        this.activePositions.delete(tokenId);
      }
      
      // record in trading history
      this.tradingHistory.push({
        tokenId,
        action: 'sell',
        amount: sellAmount,
        price: bestBid.price,
        sellTime: Date.now(),
        orderResult
      });
      
      logger.info('Sell order executed', {
        tokenId,
        amount: sellAmount,
        price: bestBid.price,
        remainingAmount: position.amount
      });
      
      return orderResult;
      
    } catch (error) {
      logger.error('Error selling position', { tokenId, error: error.message });
      throw error;
    }
  }

  // check auto-sell conditions
  checkAutoSellConditions() {
    try {
      for (const [tokenId, position] of this.activePositions.entries()) {
        // calculate current value vs buy price
        const timeHeld = Date.now() - position.buyTime;
        const hoursHeld = timeHeld / (1000 * 60 * 60);
        
        // auto-sell conditions (customize as needed)
        if (hoursHeld > 2) { // Auto-sell after 2 hours
          this.sellPosition(tokenId);
          logger.info('Auto-sold position due to time limit', { tokenId, hoursHeld });
        }
      }
    } catch (error) {
      logger.error('Error checking auto-sell conditions', { error: error.message });
    }
  }

  // get total position value
  getTotalPositionValue() {
    let total = 0;
    for (const position of this.activePositions.values()) {
      total += position.amount;
    }
    return total;
  }

  // load active positions from polymarket
  async loadActivePositions() {
    try {
      const activeOrders = await this.polymarketClient.getActiveOrders();
      
      for (const order of activeOrders) {
        // this is a simplified implementation - you may need to correlate orders with your local position tracking
        logger.info('Found active order', { orderId: order.order_id, tokenId: order.token_id });
      }
      
    } catch (error) {
      logger.error('Error loading active positions', { error: error.message });
    }
  }

  // start the main trading loop
  startTradingLoop() {
    const tradingInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(tradingInterval);
        return;
      }
      
      try {
        this.checkTradingOpportunities();
        
        if (this.autoSellEnabled) {
          this.checkAutoSellConditions();
        }
        
      } catch (error) {
        logger.error('Error in trading loop', { error: error.message });
      }
    }, 30000); // check every 30 seconds
  }

  // start periodic cleanup
  startPeriodicCleanup() {
    setInterval(() => {
      if (!this.isRunning) return;
      
      try {
        // clear old data
        this.oddsComparison.clearOldData(60); // Clear data older than 1 hour
        
        // log status
        const status = this.getStatus();
        logger.info('Bot status', status);
        
      } catch (error) {
        logger.error('Error in periodic cleanup', { error: error.message });
      }
    }, 300000); // every 5 minutes
  }

  // get bot status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activePositions: this.activePositions.size,
      totalPositionValue: this.getTotalPositionValue(),
      tradingHistory: this.tradingHistory.length,
      dataStatus: this.oddsComparison.getDataStatus(),
      connectionStatus: this.boltOddsClient.getConnectionStatus()
    };
  }

  // get active positions
  getActivePositions() {
    return Array.from(this.activePositions.entries()).map(([tokenId, position]) => ({
      tokenId,
      ...position
    }));
  }

  // get trading history
  getTradingHistory() {
    return this.tradingHistory;
  }

  // save trading history (placeholder)
  async saveTradingHistory() {
    // implement saving to file or database
    logger.info('Trading history saved', { count: this.tradingHistory.length });
  }
}

export default TradingBot;
