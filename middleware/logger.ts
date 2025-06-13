// src/middleware/logger.ts
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

const logDir = path.join(process.cwd(), 'logs');
const logFilePath = path.join(logDir, 'logs.log');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const logger = (req: Request, res: Response, next: NextFunction) => {
  let ip = req.ip;
  if (ip && ip.includes('::ffff')) {
    ip = ip.substring(7);
  }

  const start = new Date();

  res.on('finish', () => {
    const end = new Date();
    const duration = end.getTime() - start.getTime();

    const status = res.statusCode;
    const success = status >= 200 && status < 400 ? 'SUCCESS' : 'FAILURE';

    const logMsg = `${end.toLocaleString()} - ${req.method} ${req.originalUrl} - IP: ${ip} - Status: ${status} - ${success} - Duration: ${duration}ms\n`;

    logStream.write(logMsg, 'utf8');
  });

  next();
};

export default logger;
