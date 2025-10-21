import logger from '../utils/logger.js';
import config from '../config/config.js';

export class OddsComparison {
  constructor() {
    this.boltOddsData = new Map(); // Store BoltOdds data by game
    this.polymarketData = new Map(); // Store Polymarket data by token
    this.valueThreshold = config.MIN_VALUE_THRESHOLD;
  }

  // update boltodds data for a specific game
  updateBoltOddsData(gameData) {
    const gameKey = this.createGameKey(gameData);
    this.boltOddsData.set(gameKey, {
      ...gameData,
      timestamp: Date.now()
    });
    
    logger.debug('Updated BoltOdds data', { 
      gameKey,
      outcomes: Object.keys(gameData.outcomes || {})
    });
  }

  // update polymarket data for a specific token
  updatePolymarketData(tokenId, marketData) {
    this.polymarketData.set(tokenId, {
      ...marketData,
      timestamp: Date.now()
    });
    
    logger.debug('Updated Polymarket data', { tokenId });
  }

  // create a unique key for a game
  createGameKey(gameData) {
    return `${gameData.sport}_${gameData.home_team}_${gameData.away_team}_${gameData.game}`;
  }

  // convert american odds to decimal odds
  americanToDecimal(americanOdds) {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    } else {
      return (100 / Math.abs(americanOdds)) + 1;
    }
  }

  // convert decimal odds to american odds
  decimalToAmerican(decimalOdds) {
    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  }

  // convert polymarket price to decimal odds (polymarket prices are between 0-1, where 0.5 = even odds)
  polymarketPriceToDecimal(price) {
    if (price <= 0 || price >= 1) {
      return null;
    }
    return 1 / price;
  }

  // convert polymarket price to american odds
  polymarketPriceToAmerican(price) {
    if (price <= 0 || price >= 1) {
      return null;
    }
    const decimalOdds = this.polymarketPriceToDecimal(price);
    return this.decimalToAmerican(decimalOdds);
  }

  // format polymarket price as cents (e.g., 0.50 -> 50¢)
  formatPolymarketCents(price) {
    if (price <= 0 || price >= 1) {
      return 'N/A';
    }
    return `${Math.round(price * 100)}¢`;
  }

  // get comprehensive odds display for polymarket price
  formatPolymarketOdds(price) {
    if (price <= 0 || price >= 1) {
      return {
        cents: 'N/A',
        decimal: 'N/A',
        american: 'N/A',
        impliedProbability: 'N/A'
      };
    }

    const cents = this.formatPolymarketCents(price);
    const decimal = this.polymarketPriceToDecimal(price);
    const american = this.polymarketPriceToAmerican(price);
    const impliedProbability = (price * 100).toFixed(1);

    return {
      cents,
      decimal: decimal ? decimal.toFixed(2) : 'N/A',
      american: american ? (american > 0 ? `+${american}` : american.toString()) : 'N/A',
      impliedProbability: `${impliedProbability}%`
    };
  }

  // format american odds with proper sign
  formatAmericanOdds(americanOdds) {
    if (americanOdds === null || americanOdds === undefined) {
      return 'N/A';
    }
    return americanOdds > 0 ? `+${americanOdds}` : americanOdds.toString();
  }

  // format decimal odds with 2 decimal places
  formatDecimalOdds(decimalOdds) {
    if (decimalOdds === null || decimalOdds === undefined) {
      return 'N/A';
    }
    return decimalOdds.toFixed(2);
  }

  // format implied probability as percentage
  formatImpliedProbability(probability) {
    if (probability === null || probability === undefined) {
      return 'N/A';
    }
    return `${(probability * 100).toFixed(1)}%`;
  }

  // calculate implied probability from odds
  calculateImpliedProbability(odds) {
    const decimalOdds = typeof odds === 'string' || typeof odds === 'number' 
      ? this.americanToDecimal(parseFloat(odds)) 
      : odds;
    
    return 1 / decimalOdds;
  }

  // find matching markets between boltodds and polymarket
  findMatchingMarkets() {
    const matches = [];
    
    for (const [gameKey, boltData] of this.boltOddsData) {
      const gameInfo = this.extractGameInfo(boltData);
      
      for (const [tokenId, polyData] of this.polymarketData) {
        const match = this.compareMarkets(gameKey, boltData, tokenId, polyData);
        if (match) {
          matches.push(match);
        }
      }
    }
    
    return matches;
  }

  // extract game information from boltodds data
  extractGameInfo(boltData) {
    return {
      sport: boltData.sport,
      homeTeam: boltData.home_team,
      awayTeam: boltData.away_team,
      game: boltData.game,
      timestamp: boltData.timestamp
    };
  }

  // compare a boltodds market with a polymarket token
  compareMarkets(gameKey, boltData, tokenId, polyData) {
    // this is a simplified matching logic - you may need to enhance this based on how polymarket structures their nhl markets
    
    const gameInfo = this.extractGameInfo(boltData);
    
    // check if this is an nhl game and if the market description matches
    if (gameInfo.sport !== 'NHL') {
      return null;
    }

    // look for moneyline markets in boltodds
    const moneylineOutcomes = this.findMoneylineOutcomes(boltData);
    
    if (moneylineOutcomes.length === 0) {
      return null;
    }

    // for now, we'll create a basic comparison structure - you'll need to enhance this based on polymarket's actual market structure
    const polymarketPrice = polyData.price || 0.5;
    const comparison = {
      gameKey,
      tokenId,
      gameInfo,
      boltOdds: moneylineOutcomes,
      polymarket: {
        tokenId,
        price: polymarketPrice,
        decimalOdds: this.polymarketPriceToDecimal(polymarketPrice),
        americanOdds: this.polymarketPriceToAmerican(polymarketPrice),
        formattedOdds: this.formatPolymarketOdds(polymarketPrice)
      },
      timestamp: Date.now()
    };

    return comparison;
  }

  // find moneyline outcomes in boltodds data
  findMoneylineOutcomes(boltData) {
    const outcomes = [];
    
    for (const [outcomeKey, outcome] of Object.entries(boltData.outcomes || {})) {
      if (outcome.outcome_name === 'Moneyline' && outcome.odds) {
        const americanOdds = parseFloat(outcome.odds);
        const decimalOdds = this.americanToDecimal(americanOdds);
        const impliedProbability = this.calculateImpliedProbability(americanOdds);
        
        outcomes.push({
          team: outcome.outcome_target,
          odds: outcome.odds,
          americanOdds: americanOdds,
          decimalOdds: decimalOdds,
          impliedProbability: impliedProbability,
          formattedOdds: {
            american: this.formatAmericanOdds(americanOdds),
            decimal: this.formatDecimalOdds(decimalOdds),
            impliedProbability: this.formatImpliedProbability(impliedProbability)
          },
          link: outcome.link
        });
      }
    }
    
    return outcomes;
  }

  // calculate value for a potential trade (todo: implement your custom value calculation formula here)
  calculateValue(comparison) {
    // this is a placeholder for your value calculation formula - you mentioned you'll provide the formula later
    
    const { boltOdds, polymarket } = comparison;
    
    if (boltOdds.length === 0 || !polymarket.decimalOdds) {
      return null;
    }

    // basic value calculation example (replace with your formula)
    let bestValue = null;
    let bestOutcome = null;

    for (const outcome of boltOdds) {
      // calculate value as difference between implied probabilities
      const value = outcome.impliedProbability - (1 / polymarket.decimalOdds);
      
      if (value > this.valueThreshold) {
        if (!bestValue || value > bestValue) {
          bestValue = value;
          bestOutcome = outcome;
        }
      }
    }

    if (bestValue && bestOutcome) {
      return {
        value: bestValue,
        outcome: bestOutcome,
        polymarketOdds: polymarket.decimalOdds,
        recommendedAction: 'buy',
        confidence: this.calculateConfidence(bestValue)
      };
    }

    return null;
  }

  // calculate confidence score for a trade recommendation
  calculateConfidence(value) {
    // simple confidence calculation based on value magnitude
    if (value > 0.15) return 'high';
    if (value > 0.1) return 'medium';
    return 'low';
  }

  // find all trading opportunities
  findTradingOpportunities() {
    const opportunities = [];
    const matches = this.findMatchingMarkets();
    
    for (const match of matches) {
      const value = this.calculateValue(match);
      
      if (value) {
        opportunities.push({
          ...match,
          valueAnalysis: value,
          recommendation: {
            action: value.recommendedAction,
            tokenId: match.tokenId,
            confidence: value.confidence,
            expectedValue: value.value
          }
        });
      }
    }
    
    return opportunities.sort((a, b) => b.valueAnalysis.value - a.valueAnalysis.value);
  }

  // get current data status
  getDataStatus() {
    return {
      boltOddsGames: this.boltOddsData.size,
      polymarketTokens: this.polymarketData.size,
      lastUpdate: Math.max(
        ...Array.from(this.boltOddsData.values()).map(d => d.timestamp || 0),
        ...Array.from(this.polymarketData.values()).map(d => d.timestamp || 0)
      )
    };
  }

  // display odds comparison in a formatted table
  displayOddsComparison(comparison) {
    if (!comparison) return 'No comparison data available';

    const { gameInfo, boltOdds, polymarket } = comparison;
    
    let output = `\n=== ${gameInfo.homeTeam} vs ${gameInfo.awayTeam} ===\n`;
    output += `Token ID: ${polymarket.tokenId}\n\n`;
    
    // display polymarket odds
    output += `📊 POLYMARKET ODDS:\n`;
    output += `   Cents: ${polymarket.formattedOdds.cents}\n`;
    output += `   Decimal: ${polymarket.formattedOdds.decimal}x\n`;
    output += `   American: ${polymarket.formattedOdds.american}\n`;
    output += `   Implied Probability: ${polymarket.formattedOdds.impliedProbability}\n\n`;
    
    // display boltodds for each team
    output += `🏒 BOLTODDS COMPARISON:\n`;
    for (const outcome of boltOdds) {
      output += `   ${outcome.team}:\n`;
      output += `     American: ${outcome.formattedOdds.american}\n`;
      output += `     Decimal: ${outcome.formattedOdds.decimal}x\n`;
      output += `     Implied Probability: ${outcome.formattedOdds.impliedProbability}\n`;
      
      // calculate difference
      const polyProb = parseFloat(polymarket.formattedOdds.impliedProbability);
      const boltProb = parseFloat(outcome.formattedOdds.impliedProbability.replace('%', ''));
      const difference = boltProb - polyProb;
      
      output += `     Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(1)}%\n\n`;
    }
    
    return output;
  }

  // display all current opportunities in a formatted way
  displayAllOpportunities() {
    const opportunities = this.findTradingOpportunities();
    
    if (opportunities.length === 0) {
      return '\n🔍 No trading opportunities found at this time.\n';
    }
    
    let output = `\n🎯 FOUND ${opportunities.length} TRADING OPPORTUNITY(IES):\n`;
    output += '='.repeat(60) + '\n';
    
    opportunities.forEach((opp, index) => {
      output += `${index + 1}. `;
      output += this.displayOddsComparison(opp);
      
      if (opp.valueAnalysis) {
        output += `💡 VALUE ANALYSIS:\n`;
        output += `   Expected Value: ${(opp.valueAnalysis.value * 100).toFixed(2)}%\n`;
        output += `   Confidence: ${opp.valueAnalysis.confidence.toUpperCase()}\n`;
        output += `   Recommendation: ${opp.valueAnalysis.recommendedAction.toUpperCase()}\n`;
      }
      
      output += '\n' + '-'.repeat(60) + '\n';
    });
    
    return output;
  }

  // get a quick summary of all current odds
  getOddsSummary() {
    const summary = {
      boltOddsGames: this.boltOddsData.size,
      polymarketTokens: this.polymarketData.size,
      opportunities: this.findTradingOpportunities().length,
      lastUpdate: new Date(this.getDataStatus().lastUpdate).toLocaleString()
    };
    
    return summary;
  }

  // clear old data (older than specified minutes)
  clearOldData(maxAgeMinutes = 60) {
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);
    
    for (const [key, data] of this.boltOddsData.entries()) {
      if (data.timestamp < cutoffTime) {
        this.boltOddsData.delete(key);
      }
    }
    
    for (const [key, data] of this.polymarketData.entries()) {
      if (data.timestamp < cutoffTime) {
        this.polymarketData.delete(key);
      }
    }
    
    logger.info('Cleared old data', { 
      cutoffTime: new Date(cutoffTime).toISOString(),
      remainingBoltOdds: this.boltOddsData.size,
      remainingPolymarket: this.polymarketData.size
    });
  }
}

export default OddsComparison;
