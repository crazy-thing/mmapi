import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateApiKey } from '../middleware/authApiKey.js';
import logger from '../middleware/logger.js';

const authRouter = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,  // Disable the old X-RateLimit-* headers
});

authRouter.use(limiter);
authRouter.use(authenticateApiKey);
authRouter.use(logger);

authRouter.post('/authenticate', (req: Request, res: Response) => {
  res.status(200).json({ message: 'API key authenticated successfully' });
});

export default authRouter;
