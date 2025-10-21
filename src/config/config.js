import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// configuration schema
const configSchema = Joi.object({
  // boltodds configuration
  BOLTODDS_API_KEY: Joi.string().required(),
  BOLTODDS_WS_URL: Joi.string().uri().default('wss://spro.agency/api'),
  
  // polymarket configuration
  POLYMARKET_CLOB_URL: Joi.string().uri().default('https://clob.polymarket.com'),
  POLYMARKET_PRIVATE_KEY: Joi.string().required(),
  POLYMARKET_WALLET_ADDRESS: Joi.string().required(),
  
  // trading configuration
  MIN_VALUE_THRESHOLD: Joi.number().min(0).max(1).default(0.05),
  MAX_POSITION_SIZE: Joi.number().min(0).default(100),
  AUTO_SELL_ENABLED: Joi.boolean().default(false),
  AUTO_SELL_THRESHOLD: Joi.number().min(0).max(1).default(0.1),
  
  // logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE: Joi.string().default('logs/trading.log')
});

// validate configuration
const { error, value: config } = configSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true
});

if (error) {
  throw new Error(`Configuration validation error: ${error.details[0].message}`);
}

export default config;
