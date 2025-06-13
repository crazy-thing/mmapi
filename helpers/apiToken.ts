// src/helpers/apiToken.ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const apiTokenDir = path.join(process.cwd(), 'apiToken');
const apiTokenPath = path.join(apiTokenDir, 'apiToken.json');

interface ApiToken {
  token: string;
}

export async function checkApiToken(): Promise<void> {
  try {
    // Ensure directory exists
    await fs.mkdir(apiTokenDir, { recursive: true });

    // Check if token file exists
    try {
      const data = await fs.readFile(apiTokenPath, 'utf8');
      const apiToken: ApiToken = JSON.parse(data);
      if (!apiToken.token) {
        const newToken = generateToken();
        apiToken.token = newToken;
        console.log(`Generated API Key: ${newToken}`);
        await writeTokenToFile(apiToken);
      } else {
        console.log(`Existing API Key: ${apiToken.token}`);
      }
    } catch (readError) {
      // File does not exist or error reading/parsing
      const newToken = generateToken();
      const apiToken: ApiToken = { token: newToken };
      console.log(`Generated API Key: ${newToken}`);
      await writeTokenToFile(apiToken);
    }
  } catch (err) {
    console.error('Error ensuring API token directory or file:', err);
  }
}

function generateToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

async function writeTokenToFile(apiToken: ApiToken): Promise<void> {
  const jsonData = JSON.stringify(apiToken, null, 4);
  try {
    await fs.writeFile(apiTokenPath, jsonData);
    console.log('API token file created successfully');
  } catch (err) {
    console.error('Error writing API token file:', err);
  }
}
