const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/routes/config.ts';
let code = fs.readFileSync(path, 'utf8');

// Add import
if (!code.includes("import { requireAuth }")) {
  code = code.replace("import { Router } from 'express';", "import { Router } from 'express';\nimport { requireAuth } from '../middlewares/auth';");
}

// Add middleware to routes
code = code.replace("router.get('/:accountId', async (req, res) => {", "router.get('/:accountId', requireAuth, async (req, res) => {");
code = code.replace("router.post('/:accountId', async (req, res) => {", "router.post('/:accountId', requireAuth, async (req, res) => {");
code = code.replace("router.get('/:accountId/metrics', async (req, res) => {", "router.get('/:accountId/metrics', requireAuth, async (req, res) => {");

fs.writeFileSync(path, code, 'utf8');
console.log("config.ts patched to use requireAuth");
