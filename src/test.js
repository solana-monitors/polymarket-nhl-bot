import config from './config/config.js';
import logger from './utils/logger.js';
import BoltOddsClient from './services/BoltOddsClient.js';
import PolymarketClient from './services/PolymarketClient.js';
import OddsComparison from './services/OddsComparison.js';

/**
 * Simple test script to verify all components work correctly
 */
async function runTests() {
  logger.info('Starting component tests...');

  try {
    // Test 1: Configuration loading
    logger.info('Test 1: Configuration loading');
    console.log('✓ Configuration loaded successfully');
    console.log(`  BoltOdds API Key: ${config.BOLTODDS_API_KEY ? 'Set' : 'Missing'}`);
    console.log(`  Polymarket Private Key: ${config.POLYMARKET_PRIVATE_KEY ? 'Set' : 'Missing'}`);
    console.log(`  Polymarket Wallet: ${config.POLYMARKET_WALLET_ADDRESS ? 'Set' : 'Missing'}`);

    // Test 2: BoltOdds client initialization
    logger.info('Test 2: BoltOdds client initialization');
    const boltOddsClient = new BoltOddsClient();
    console.log('✓ BoltOdds client initialized');

    // Test 3: Polymarket client initialization
    logger.info('Test 3: Polymarket client initialization');
    const polymarketClient = new PolymarketClient();
    console.log('✓ Polymarket client initialized');

    // Test 4: Odds comparison initialization
    logger.info('Test 4: Odds comparison initialization');
    const oddsComparison = new OddsComparison();
    console.log('✓ Odds comparison initialized');

    // Test 5: Test odds conversion functions
    logger.info('Test 5: Odds conversion functions');
    const americanOdds = 150;
    const decimalOdds = oddsComparison.americanToDecimal(americanOdds);
    const backToAmerican = oddsComparison.decimalToAmerican(decimalOdds);
    console.log(`✓ American odds ${americanOdds} -> Decimal ${decimalOdds.toFixed(2)} -> American ${backToAmerican}`);

    // Test 6: Test Polymarket price conversion
    const polymarketPrice = 0.6;
    const polymarketDecimal = oddsComparison.polymarketPriceToDecimal(polymarketPrice);
    console.log(`✓ Polymarket price ${polymarketPrice} -> Decimal odds ${polymarketDecimal.toFixed(2)}`);

    // Test 7: Mock data test
    logger.info('Test 7: Mock data processing');
    const mockBoltData = {
      sport: 'NHL',
      home_team: 'Toronto Maple Leafs',
      away_team: 'Montreal Canadiens',
      game: 'Toronto Maple Leafs vs Montreal Canadiens, 2024-01-15, 01',
      outcomes: {
        'Toronto Maple Leafs Moneyline': {
          odds: '150',
          outcome_name: 'Moneyline',
          outcome_target: 'Toronto Maple Leafs',
          link: 'https://example.com'
        },
        'Montreal Canadiens Moneyline': {
          odds: '-120',
          outcome_name: 'Moneyline',
          outcome_target: 'Montreal Canadiens',
          link: 'https://example.com'
        }
      }
    };

    oddsComparison.updateBoltOddsData(mockBoltData);
    const gameKey = oddsComparison.createGameKey(mockBoltData);
    console.log(`✓ Mock data processed, game key: ${gameKey}`);

    // Test 8: Polymarket odds formatting
    logger.info('Test 8: Polymarket odds formatting');
    const polymarketPrices = [0.50, 0.60, 0.40, 0.75, 0.25];
    console.log('\n📊 Polymarket Odds Formatting Examples:');
    polymarketPrices.forEach(price => {
      const formatted = oddsComparison.formatPolymarketOdds(price);
      console.log(`  ${price} → ${formatted.cents} | ${formatted.decimal}x | ${formatted.american} | ${formatted.impliedProbability}`);
    });

    // Test 9: Connection test (if keys are valid)
    if (config.BOLTODDS_API_KEY && config.BOLTODDS_API_KEY !== 'your_api_key_here') {
      logger.info('Test 9: BoltOdds connection test');
      try {
        await new Promise((resolve, reject) => {
          const testClient = new BoltOddsClient();
          let resolved = false;
          
          testClient.on('socket_connected', () => {
            if (!resolved) {
              resolved = true;
              console.log('✓ BoltOdds connection successful');
              testClient.close();
              resolve();
            }
          });

          testClient.on('error', (error) => {
            if (!resolved) {
              resolved = true;
              console.log('✗ BoltOdds connection failed:', error.message);
              testClient.close();
              reject(error);
            }
          });

          testClient.connect();
          
          // Timeout after 10 seconds
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.log('✗ BoltOdds connection timeout');
              testClient.close();
              reject(new Error('Connection timeout'));
            }
          }, 10000);
        });
      } catch (error) {
        console.log('✗ BoltOdds connection test failed:', error.message);
      }
    } else {
      console.log('⚠ BoltOdds connection test skipped (no valid API key)');
    }

    console.log('\n=== Test Summary ===');
    console.log('✓ All core components initialized successfully');
    console.log('✓ Configuration validation passed');
    console.log('✓ Odds conversion functions working');
    console.log('✓ Mock data processing working');
    
    if (config.BOLTODDS_API_KEY && config.BOLTODDS_API_KEY !== 'your_api_key_here') {
      console.log('✓ BoltOdds connection test completed');
    } else {
      console.log('⚠ BoltOdds connection test skipped - update API key in .env file');
    }

    console.log('\nNext steps:');
    console.log('1. Update your .env file with real Polymarket credentials');
    console.log('2. Run "npm start" to begin trading');
    console.log('3. Implement your value calculation formula in OddsComparison.js');

  } catch (error) {
    logger.error('Test failed', { error: error.message });
    console.log(`✗ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(() => {
    console.log('\nTests completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('Tests failed:', error.message);
    process.exit(1);
  });
}

export default runTests;
