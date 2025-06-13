// src/middleware/authApiKey.ts
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

const apiTokenDir = path.join(process.cwd(), 'apiToken');
if (!fs.existsSync(apiTokenDir)) {
  fs.mkdirSync(apiTokenDir, { recursive: true });
}

const apiTokenFilePath = path.join(apiTokenDir, 'apiToken.json');

export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  fs.readFile(apiTokenFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading API token file:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    try {
      const { token } = JSON.parse(data);
      console.log('API Token:', token); // Debug log

      const apiKey = req.headers['x-api-key'];
      console.log('API Key from request:', apiKey); // Debug log

      if (!apiKey) {
        return res.status(401).json({ message: 'API key is required' });
      }

      if (Array.isArray(apiKey)) {
        // Header could be string[] if multiple keys sent
        return res.status(401).json({ message: 'Invalid API key format' });
      }

      if (apiKey !== token) {
        return res.status(401).json({ message: 'Invalid API key' });
      }

      next();
    } catch (parseError) {
      console.error('Error parsing API token file:', parseError);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
};
