import WebSocket from 'ws';
import config from '../config/config.js';
import logger from '../utils/logger.js';

export class BoltOddsClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.subscriptionFilters = {
      sports: ['NHL'],
      sportsbooks: [], // Empty means all sportsbooks
      games: [], // Empty means all games
      markets: ['Moneyline', 'Spread', 'Total'] // NHL markets
    };
    this.messageHandlers = new Map();
  }

  // initialize websocket connection
  async connect() {
    try {
      const uri = `${config.BOLTODDS_WS_URL}?key=${config.BOLTODDS_API_KEY}`;
      logger.info('Connecting to BoltOdds WebSocket...', { uri: uri.replace(config.BOLTODDS_API_KEY, '***') });
      
      this.ws = new WebSocket(uri);
      
      this.ws.on('open', () => {
        logger.info('Connected to BoltOdds WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.subscribe();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        logger.warn('BoltOdds WebSocket connection closed', { code, reason: reason.toString() });
        this.isConnected = false;
        this.handleReconnection();
      });

      this.ws.on('error', (error) => {
        logger.error('BoltOdds WebSocket error', { error: error.message });
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('Failed to connect to BoltOdds WebSocket', { error: error.message });
      this.handleReconnection();
    }
  }

  // subscribe to nhl data feeds
  subscribe() {
    if (!this.isConnected || !this.ws) {
      logger.error('Cannot subscribe: WebSocket not connected');
      return;
    }

    const subscribeMessage = {
      action: 'subscribe',
      filters: this.subscriptionFilters
    };

    logger.info('Subscribing to NHL data feeds', { filters: this.subscriptionFilters });
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  // handle incoming messages
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.action) {
        case 'socket_connected':
          logger.info('BoltOdds authentication successful');
          break;
          
        case 'initial_state':
          logger.info('Received initial state', { 
            sport: message.data?.sport,
            game: message.data?.game 
          });
          this.emit('initialState', message.data);
          break;
          
        case 'game_update':
          logger.debug('Game update received', { 
            sport: message.data?.sport,
            game: message.data?.game 
          });
          this.emit('gameUpdate', message.data);
          break;
          
        case 'game_removed':
          logger.info('Game removed', { 
            sport: message.data?.sport,
            game: message.data?.game 
          });
          this.emit('gameRemoved', message.data);
          break;
          
        case 'game_added':
          logger.info('Game added', { 
            sport: message.data?.sport,
            game: message.data?.game 
          });
          this.emit('gameAdded', message.data);
          break;
          
        case 'line_update':
          logger.debug('Line update received', { 
            sport: message.data?.sport,
            game: message.data?.game,
            outcomes: Object.keys(message.data?.outcomes || {})
          });
          this.emit('lineUpdate', message.data);
          break;
          
        case 'book_clear':
          logger.warn('Book cleared', { sportsbook: message.data?.sportsbook });
          this.emit('bookClear', message.data);
          break;
          
        case 'ping':
          // keep-alive message, no action needed
          break;
          
        case 'error':
          logger.error('BoltOdds error', { message: message.message });
          this.emit('error', message);
          break;
          
        case 'subscription_updated':
          logger.info('Subscription updated successfully');
          this.emit('subscriptionUpdated', message);
          break;
          
        default:
          logger.warn('Unknown message type received', { action: message.action });
      }
    } catch (error) {
      logger.error('Error parsing BoltOdds message', { error: error.message, data: data.toString() });
    }
  }

  // handle reconnection logic
  handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Stopping reconnection.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // update subscription filters
  updateSubscription(filters) {
    this.subscriptionFilters = { ...this.subscriptionFilters, ...filters };
    
    if (this.isConnected && this.ws) {
      const subscribeMessage = {
        action: 'subscribe',
        filters: this.subscriptionFilters
      };
      
      logger.info('Updating subscription filters', { filters: this.subscriptionFilters });
      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  // event emitter functionality
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.messageHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('Error in event handler', { event, error: error.message });
      }
    });
  }

  // get current connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptionFilters: this.subscriptionFilters
    };
  }

  // close connection
  close() {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
      logger.info('BoltOdds WebSocket connection closed');
    }
  }
}

export default BoltOddsClient;
