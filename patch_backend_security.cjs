const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/routes/auth.ts';
let code = fs.readFileSync(path, 'utf8');

const oldRouteStart = `router.post('/iframe-bypass', (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });`;

const newRouteStart = `router.post('/iframe-bypass', (req, res) => {
  const origin = req.get('origin') || '';
  const referer = req.get('referer') || '';

  const isTrusted = origin.includes('chat.zabotek.com') || referer.includes('chat.zabotek.com') || origin.includes('localhost');

  if (!isTrusted) {
    console.warn(\`[Security] Bloqueado intento de bypass desde Origin: \${origin}, Referer: \${referer}\`);
    return res.status(403).json({ error: 'Acceso denegado. Origen no confiable.' });
  }

  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });`;

if (code.includes("router.post('/iframe-bypass'")) {
  code = code.replace(oldRouteStart, newRouteStart);
  fs.writeFileSync(path, code, 'utf8');
  console.log("Security lock added");
} else {
  console.log("Route not found");
}
