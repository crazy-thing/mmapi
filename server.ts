import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import path from 'path';

import modPackRouter from './routers/modpacksRouter.js';
import authRouter from './routers/authRouter.js';
import { checkApiToken } from './helpers/apiToken.js';

const connectToDatabase = async (callback: () => void): Promise<void> => {
  try {
    await checkApiToken();
    console.log("Attempting to connect to MongoDB...");
    await mongoose.connect(process.env.DB_ADDR as string);
    console.log('Connected to MongoDB');
    callback();
  } catch (error) {
    console.error(`MongoDB connection failed: ${error}`);
    connectToDatabase(callback); 
  }
};

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const API_URL = process.env.API_URL || '/api';
const screenshotsPath = path.join(process.cwd(), '/uploads/screenshots');

app.use(bodyParser.json({ limit: '10000mb' }));
app.use(bodyParser.urlencoded({ limit: '10000mb', extended: true }));
app.use(cors());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.set('trust proxy', "::1");
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:10000", "https://localhost:10000", "http://localhost", "https://localhost", ""],
      imgSrc: ["*", "data:", "blob:"],
      upgradeInsecureRequests: null
    },
  },
}));

app.use(API_URL, modPackRouter);
app.use(API_URL, authRouter);

app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('uploads'));

connectToDatabase(() => {
  app.use(express.static('dist'));
  app.use('/screenshots', express.static(screenshotsPath));


  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  app.get(/(.*)/, (req: Request, res: Response) => {
    res.sendFile('index.html', { root: 'dist' });
  });
});
