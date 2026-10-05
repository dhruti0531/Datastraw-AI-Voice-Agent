import dotenv from 'dotenv';
import path from 'path';

const potentialEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envPath of potentialEnvPaths) {
  dotenv.config({ path: envPath });
}
dotenv.config(); // fallback to default

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  TTS_VOICE: process.env.TTS_VOICE || 'shimmer', // 'shimmer' has a soft, clear female tone
  TTS_SPEED: process.env.TTS_SPEED ? parseFloat(process.env.TTS_SPEED) : 1.15,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173'
};
