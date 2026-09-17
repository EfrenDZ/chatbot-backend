import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { webhookRouter } from './routes/webhook';
import { configRouter } from './routes/config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Permite peticiones desde el frontend (puerto 5173 o Chatwoot)
app.use(express.json());

// API Routes
app.use('/webhook', webhookRouter);
app.use('/api/config', configRouter);

// Servir el Frontend de React compilado (dist)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Cualquier otra ruta la maneja React (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Chatbot SaaS Backend running on http://localhost:${PORT}`);
});
