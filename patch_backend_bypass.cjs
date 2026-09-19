const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/routes/auth.ts';
let code = fs.readFileSync(path, 'utf8');

const newRoute = `
// Endpoint especial para auto-login desde el Iframe de Chatwoot
router.post('/iframe-bypass', (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

  // Generamos un token JWT válido solo para esta cuenta
  const token = jwt.sign(
    { 
      uid: 'iframe-auto-login', 
      email: 'iframe@zabotek.com',
      accounts: [parseInt(accountId, 10)]
    }, 
    JWT_SECRET, 
    { expiresIn: '1d' }
  );

  res.json({ token, user: { name: 'Chatwoot Iframe', accounts: [{ id: parseInt(accountId, 10) }] } });
});
`;

if (!code.includes('/iframe-bypass')) {
  code = code.replace("export default router;", newRoute + "\nexport default router;");
  fs.writeFileSync(path, code, 'utf8');
}
console.log("Backend iframe bypass injected");
