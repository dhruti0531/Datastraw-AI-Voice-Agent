import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config/index.js';
import apiRouter from './routes/api.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow development & deployed client origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Mount API routes
app.use('/api', apiRouter);

// Serve static frontend assets if built
const frontendDistPath = path.resolve(process.cwd(), 'frontend/dist');
const localDistPublic = path.resolve(process.cwd(), './public');

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else if (fs.existsSync(localDistPublic)) {
  app.use(express.static(localDistPublic));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(localDistPublic, 'index.html'));
  });
} else {
  // Root route for ping
  app.get('/', (req, res) => {
    res.json({
      message: 'Aura Skincare AI Voice Agent API is running.',
      agent: 'Aria',
      docs: '/api/health'
    });
  });
}

// Start listening
const server = app.listen(CONFIG.PORT, () => {
  console.log(`====================================================`);
  console.log(`🌸 Aura Skincare AI Voice Support Server (Aria)`);
  console.log(`📡 Listening on http://localhost:${CONFIG.PORT}`);
  console.log(`🔑 OpenAI API Key status: ${CONFIG.OPENAI_API_KEY ? 'Configured ✅' : 'Not configured in env ⚠️'}`);
  console.log(`⚙️  Model: ${CONFIG.OPENAI_MODEL} | Voice: ${CONFIG.TTS_VOICE}`);
  console.log(`====================================================`);
});

export default app;
