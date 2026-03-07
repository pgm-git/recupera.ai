import dotenv from 'dotenv';
dotenv.config();

// Validate required env vars before importing app
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'UAZAPI_BASE_URL', 'UAZAPI_ADMIN_TOKEN'];
// AI key: DeepSeek or OpenAI (at least one required)
if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
  requiredEnvVars.push('DEEPSEEK_API_KEY');
}
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
  console.warn(`⚠️  DEMO MODE: Missing env vars: ${missingVars.join(', ')}`);
  console.warn('   External services (DB, AI, WhatsApp, Queue) will not work.');
  console.warn('   Frontend will use mock data. Set vars in .env for full functionality.');
}

import http from 'http';
import { createServer as createViteServer } from 'vite';
import express from 'express';
import { app } from './express-app.ts';
import { createRecoveryWorker } from './services/recoveryWorker.ts';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Vite Middleware (Must be last)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
  }

  // Start recovery worker (skip in test/demo environments)
  if (process.env.NODE_ENV !== 'test' && process.env.REDIS_URL) {
    createRecoveryWorker();
  } else if (!process.env.REDIS_URL) {
    console.warn('⚠️  Recovery worker disabled (no REDIS_URL)');
  }

  // Use http.createServer for correct route handling with Express 5 + Vite
  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
