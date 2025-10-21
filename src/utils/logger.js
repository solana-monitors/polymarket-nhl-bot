import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// create logger instance
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // file transport
    new winston.transports.File({
      filename: path.join(__dirname, '../../', config.LOG_FILE),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;
