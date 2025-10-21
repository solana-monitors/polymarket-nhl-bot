import TradingBot from './TradingBot.js';
import logger from './utils/logger.js';
import config from './config/config.js';

class NHLTradingApp {
  constructor() {
    this.bot = new TradingBot();
    this.isRunning = false;
  }

  /**
   * Start the application
   */
  async start() {
    try {
      logger.info('Starting NHL Trading Application...');
      
      // Validate configuration
      this.validateConfiguration();
      
      // Start the trading bot
      await this.bot.start();
      this.isRunning = true;
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // Start CLI interface
      this.startCLI();
      
      logger.info('Application started successfully');
      
    } catch (error) {
      logger.error('Failed to start application', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const requiredConfigs = [
      'BOLTODDS_API_KEY',
      'POLYMARKET_PRIVATE_KEY',
      'POLYMARKET_WALLET_ADDRESS'
    ];

    for (const configKey of requiredConfigs) {
      if (!config[configKey] || config[configKey] === 'your_private_key_here' || config[configKey] === 'your_wallet_address_here') {
        throw new Error(`Missing or invalid configuration: ${configKey}`);
      }
    }

    logger.info('Configuration validated successfully');
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      if (this.isRunning) {
        await this.bot.stop();
        this.isRunning = false;
      }
      
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  /**
   * Start CLI interface
   */
  startCLI() {
    console.log('\n=== NHL Trading Bot CLI ===');
    console.log('Commands:');
    console.log('  status     - Show bot status');
    console.log('  positions  - Show active positions');
    console.log('  history    - Show trading history');
    console.log('  odds       - Show current odds comparisons');
    console.log('  opportunities - Show trading opportunities');
    console.log('  sell <id>  - Sell position by token ID');
    console.log('  help       - Show this help');
    console.log('  exit       - Stop the bot and exit\n');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'nhl-bot> '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim().split(' ');
      const command = input[0].toLowerCase();

      try {
        switch (command) {
          case 'status':
            this.showStatus();
            break;
            
          case 'positions':
            this.showPositions();
            break;
            
          case 'history':
            this.showHistory();
            break;
            
          case 'odds':
            this.showOddsComparisons();
            break;
            
          case 'opportunities':
            this.showTradingOpportunities();
            break;
            
          case 'sell':
            if (input[1]) {
              await this.sellPosition(input[1]);
            } else {
              console.log('Usage: sell <token_id>');
            }
            break;
            
          case 'help':
            this.showHelp();
            break;
            
          case 'exit':
          case 'quit':
            console.log('Stopping bot...');
            await this.bot.stop();
            rl.close();
            process.exit(0);
            break;
            
          case '':
            // Empty line, just show prompt again
            break;
            
          default:
            console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
        }
      } catch (error) {
        console.log(`Error: ${error.message}`);
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });
  }

  /**
   * Show bot status
   */
  showStatus() {
    const status = this.bot.getStatus();
    console.log('\n=== Bot Status ===');
    console.log(`Running: ${status.isRunning}`);
    console.log(`Active Positions: ${status.activePositions}`);
    console.log(`Total Position Value: $${status.totalPositionValue}`);
    console.log(`Trading History: ${status.tradingHistory} trades`);
    console.log(`BoltOdds Games: ${status.dataStatus.boltOddsGames}`);
    console.log(`Polymarket Tokens: ${status.dataStatus.polymarketTokens}`);
    console.log(`Connection Status: ${status.connectionStatus.isConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`Reconnect Attempts: ${status.connectionStatus.reconnectAttempts}`);
    console.log('');
  }

  /**
   * Show active positions
   */
  showPositions() {
    const positions = this.bot.getActivePositions();
    console.log('\n=== Active Positions ===');
    
    if (positions.length === 0) {
      console.log('No active positions');
    } else {
      positions.forEach((position, index) => {
        console.log(`${index + 1}. Token ID: ${position.tokenId}`);
        console.log(`   Game: ${position.gameInfo.homeTeam} vs ${position.gameInfo.awayTeam}`);
        console.log(`   Amount: $${position.amount}`);
        console.log(`   Buy Price: ${position.price}`);
        console.log(`   Buy Time: ${new Date(position.buyTime).toLocaleString()}`);
        console.log(`   Status: ${position.status}`);
        console.log('');
      });
    }
  }

  /**
   * Show trading history
   */
  showHistory() {
    const history = this.bot.getTradingHistory();
    console.log('\n=== Trading History ===');
    
    if (history.length === 0) {
      console.log('No trading history');
    } else {
      // Show last 10 trades
      const recentHistory = history.slice(-10);
      recentHistory.forEach((trade, index) => {
        console.log(`${index + 1}. ${trade.action.toUpperCase()} - Token: ${trade.tokenId}`);
        console.log(`   Amount: $${trade.amount}`);
        console.log(`   Price: ${trade.price}`);
        console.log(`   Time: ${new Date(trade.buyTime || trade.sellTime).toLocaleString()}`);
        if (trade.valueAnalysis) {
          console.log(`   Expected Value: ${trade.valueAnalysis.value.toFixed(4)}`);
          console.log(`   Confidence: ${trade.valueAnalysis.confidence}`);
        }
        console.log('');
      });
    }
  }

  /**
   * Sell a position
   */
  async sellPosition(tokenId) {
    try {
      console.log(`Selling position for token ${tokenId}...`);
      const result = await this.bot.sellPosition(tokenId);
      console.log('Sell order placed successfully');
      console.log(`Order ID: ${result.order_id}`);
    } catch (error) {
      console.log(`Error selling position: ${error.message}`);
    }
  }

  /**
   * Show odds comparisons
   */
  showOddsComparisons() {
    try {
      const oddsSummary = this.bot.oddsComparison.getOddsSummary();
      console.log('\n=== Current Odds Summary ===');
      console.log(`BoltOdds Games: ${oddsSummary.boltOddsGames}`);
      console.log(`Polymarket Tokens: ${oddsSummary.polymarketTokens}`);
      console.log(`Trading Opportunities: ${oddsSummary.opportunities}`);
      console.log(`Last Update: ${oddsSummary.lastUpdate}`);
      
      if (oddsSummary.boltOddsGames > 0 || oddsSummary.polymarketTokens > 0) {
        const matches = this.bot.oddsComparison.findMatchingMarkets();
        if (matches.length > 0) {
          console.log('\n=== Current Odds Comparisons ===');
          matches.forEach((match, index) => {
            console.log(this.bot.oddsComparison.displayOddsComparison(match));
          });
        } else {
          console.log('\n⚠ No matching markets found between BoltOdds and Polymarket');
        }
      } else {
        console.log('\n⚠ No data available yet. Make sure BoltOdds is connected and Polymarket data is loaded.');
      }
    } catch (error) {
      console.log(`Error showing odds comparisons: ${error.message}`);
    }
  }

  /**
   * Show trading opportunities
   */
  showTradingOpportunities() {
    try {
      const opportunities = this.bot.oddsComparison.findTradingOpportunities();
      
      if (opportunities.length === 0) {
        console.log('\n🔍 No trading opportunities found at this time.');
        console.log('This could mean:');
        console.log('- No NHL games are currently active');
        console.log('- No matching markets between BoltOdds and Polymarket');
        console.log('- No opportunities meet your value threshold');
      } else {
        console.log(this.bot.oddsComparison.displayAllOpportunities());
      }
    } catch (error) {
      console.log(`Error showing trading opportunities: ${error.message}`);
    }
  }

  /**
   * Show help
   */
  showHelp() {
    console.log('\n=== Available Commands ===');
    console.log('status         - Show bot status and connection info');
    console.log('positions      - List all active positions');
    console.log('history        - Show recent trading history');
    console.log('odds           - Show current odds comparisons');
    console.log('opportunities  - Show trading opportunities');
    console.log('sell <id>      - Sell position by token ID');
    console.log('help           - Show this help message');
    console.log('exit           - Stop the bot and exit');
    console.log('');
  }
}

// Start the application
const app = new NHLTradingApp();
app.start().catch((error) => {
  logger.error('Application failed to start', { error: error.message });
  process.exit(1);
});
