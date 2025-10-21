# NHL Trading Bot for Polymarket

A Node.js trading bot that monitors NHL games through BoltOdds API and executes trades on Polymarket based on odds comparison and value calculation.

## Features

- **Real-time NHL Data**: Connects to BoltOdds WebSocket API for live game updates and odds
- **Polymarket Integration**: Places buy/sell orders on Polymarket contracts
- **Odds Comparison**: Compares odds between BoltOdds and Polymarket to find value
- **Manual Trading**: CLI interface for manual position management
- **Auto-sell**: Optional automatic position closing based on time/conditions
- **Comprehensive Logging**: Detailed logging with Winston
- **Error Handling**: Robust error handling and reconnection logic

## Prerequisites

- Node.js 18+ 
- A Polymarket account with USDC balance
- BoltOdds API key (currently using provided key)
- Polymarket private key and wallet address

## Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the configuration template:
   ```bash
   cp config.env .env
   ```

4. Edit `.env` file with your configuration:
   ```env
   # BoltOdds Configuration (already provided)
   BOLTODDS_API_KEY=a955226-a27b-47a5-ae42-fbce7a31f3a8
   BOLTODDS_WS_URL=wss://spro.agency/api

   # Polymarket Configuration (REQUIRED)
   POLYMARKET_CLOB_URL=https://clob.polymarket.com
   POLYMARKET_PRIVATE_KEY=your_private_key_here
   POLYMARKET_WALLET_ADDRESS=your_wallet_address_here

   # Trading Configuration
   MIN_VALUE_THRESHOLD=0.05
   MAX_POSITION_SIZE=100
   AUTO_SELL_ENABLED=false
   AUTO_SELL_THRESHOLD=0.1

   # Logging
   LOG_LEVEL=info
   LOG_FILE=logs/trading.log
   ```

## Usage

### Starting the Bot

```bash
npm start
```

### CLI Commands

Once running, you can use these commands:

- `status` - Show bot status and connection info
- `positions` - List all active positions
- `history` - Show recent trading history
- `odds` - Show current odds comparisons with multiple formats
- `opportunities` - Show trading opportunities with value analysis
- `sell <token_id>` - Sell position by token ID
- `help` - Show available commands
- `exit` - Stop the bot and exit

### Example Session

```
=== NHL Trading Bot CLI ===
Commands:
  status     - Show bot status
  positions  - Show active positions
  history    - Show trading history
  sell <id>  - Sell position by token ID
  help       - Show this help
  exit       - Stop the bot and exit

nhl-bot> status

=== Bot Status ===
Running: true
Active Positions: 2
Total Position Value: $75
Trading History: 5 trades
BoltOdds Games: 3
Polymarket Tokens: 15
Connection Status: Connected
Reconnect Attempts: 0

nhl-bot> positions

=== Active Positions ===
1. Token ID: 0x123...
   Game: Toronto Maple Leafs vs Montreal Canadiens
   Amount: $50
   Buy Price: 0.65
   Buy Time: 12/15/2023, 7:30:15 PM
   Status: open

nhl-bot> odds

=== Current Odds Summary ===
BoltOdds Games: 3
Polymarket Tokens: 15
Trading Opportunities: 2
Last Update: 12/15/2023, 7:45:30 PM

=== Current Odds Comparisons ===

=== Toronto Maple Leafs vs Montreal Canadiens ===
Token ID: 0x456...

📊 POLYMARKET ODDS:
   Cents: 55¢
   Decimal: 1.82x
   American: -122
   Implied Probability: 55.0%

🏒 BOLTODDS COMPARISON:
   Toronto Maple Leafs:
     American: +150
     Decimal: 2.50x
     Implied Probability: 40.0%
     Difference: -15.0%

   Montreal Canadiens:
     American: -120
     Decimal: 1.83x
     Implied Probability: 54.5%
     Difference: -0.5%

nhl-bot> opportunities

🎯 FOUND 1 TRADING OPPORTUNITY(IES):
============================================================
1. === Toronto Maple Leafs vs Montreal Canadiens ===
Token ID: 0x456...

📊 POLYMARKET ODDS:
   Cents: 55¢
   Decimal: 1.82x
   American: -122
   Implied Probability: 55.0%

🏒 BOLTODDS COMPARISON:
   Toronto Maple Leafs:
     American: +150
     Decimal: 2.50x
     Implied Probability: 40.0%
     Difference: -15.0%

💡 VALUE ANALYSIS:
   Expected Value: 15.00%
   Confidence: HIGH
   Recommendation: BUY

nhl-bot> sell 0x123...
Selling position for token 0x123...
Sell order placed successfully
Order ID: 456789
```

## Configuration Options

### Trading Parameters

- `MIN_VALUE_THRESHOLD`: Minimum expected value to place a trade (default: 0.05)
- `MAX_POSITION_SIZE`: Maximum total position size in USDC (default: 100)
- `AUTO_SELL_ENABLED`: Enable automatic position closing (default: false)
- `AUTO_SELL_THRESHOLD`: Auto-sell threshold (default: 0.1)

### Logging

- `LOG_LEVEL`: Logging level (error, warn, info, debug)
- `LOG_FILE`: Path to log file (default: logs/trading.log)

## Architecture

### Core Components

1. **BoltOddsClient**: WebSocket client for real-time NHL data
2. **PolymarketClient**: REST API client for trading operations
3. **OddsComparison**: Logic for comparing odds and calculating value
4. **TradingBot**: Main orchestrator that coordinates all components

### Data Flow

1. BoltOdds provides live NHL game data and odds
2. OddsComparison analyzes opportunities between BoltOdds and Polymarket
3. TradingBot evaluates opportunities and places trades
4. Positions are tracked and can be manually or automatically closed

## Odds Formatting

The bot displays odds in multiple formats for easy comparison:

### Polymarket Odds Display
- **Cents**: Shows Polymarket price as cents (e.g., 0.50 → 50¢)
- **Decimal**: Converts to decimal odds (e.g., 0.50 → 2.00x)
- **American**: Converts to American odds (e.g., 0.50 → +100)
- **Implied Probability**: Shows as percentage (e.g., 0.50 → 50.0%)

### Example Conversion Table
| Polymarket Price | Cents | Decimal | American | Implied Prob |
|------------------|-------|---------|----------|--------------|
| 0.25 | 25¢ | 4.00x | +300 | 25.0% |
| 0.40 | 40¢ | 2.50x | +150 | 40.0% |
| 0.50 | 50¢ | 2.00x | +100 | 50.0% |
| 0.60 | 60¢ | 1.67x | -150 | 60.0% |
| 0.75 | 75¢ | 1.33x | -300 | 75.0% |

## Value Calculation

The value calculation formula is currently a placeholder. You'll need to implement your custom formula in the `calculateValue` method in `src/services/OddsComparison.js`.

Current placeholder logic:
- Compares implied probabilities between BoltOdds and Polymarket
- Calculates value as the difference
- Only trades when value exceeds `MIN_VALUE_THRESHOLD`

## Error Handling

- Automatic reconnection for WebSocket connections
- Comprehensive error logging
- Graceful shutdown handling
- Rate limit awareness

## Security Notes

- Never commit your `.env` file with real API keys
- Use environment variables for production deployments
- Consider using a dedicated trading wallet with limited funds
- Monitor your positions regularly

## Future Enhancements

- [ ] Implement custom value calculation formula
- [ ] Add more sophisticated position sizing (Kelly criterion)
- [ ] Implement stop-loss and take-profit orders
- [ ] Add support for other sports
- [ ] Database integration for trade history
- [ ] Web dashboard for monitoring
- [ ] More sophisticated matching between BoltOdds and Polymarket markets

## Troubleshooting

### Common Issues

1. **Connection Issues**: Check your internet connection and API keys
2. **No Opportunities**: Verify that NHL games are active and markets exist
3. **Order Failures**: Ensure sufficient USDC balance and valid wallet
4. **Configuration Errors**: Verify all required environment variables are set

### Logs

Check the log file for detailed information:
```bash
tail -f logs/trading.log
```

## License

MIT License - see LICENSE file for details.

## Disclaimer

This software is for educational purposes only. Trading involves risk and you should only trade with funds you can afford to lose. The authors are not responsible for any financial losses.
