import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { webhookRouter } from './routes/webhook';
import { configRouter } from './routes/config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Permite peticiones desde el frontend o Chatwoot
app.use(express.json());

// Health check para Coolify / Dokploy
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Chatbot SaaS Backend', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/webhook', webhookRouter);
app.use('/api/config', configRouter);

app.listen(PORT, () => {
  console.log(`🚀 Chatbot SaaS Backend running on http://localhost:${PORT}`);
});
