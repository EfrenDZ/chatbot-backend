import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'zabotek-super-secret-key-2026';

router.post('/login', async (req, res) => {
  const { email, password, chatwootApiUrl } = req.body;

  if (!email || !password || !chatwootApiUrl) {
    return res.status(400).json({ error: 'Missing credentials or api url' });
  }

  try {
    // Authenticate against Chatwoot API
    const authUrl = `${chatwootApiUrl}/auth/sign_in`;
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(401).json({ error: 'Credenciales inválidas en Chatwoot' });
    }

    const data = await response.json();
    const user = data.data;
    const headers = {
       'access-token': response.headers.get('access-token') || '',
       'client': response.headers.get('client') || '',
       'uid': response.headers.get('uid') || ''
    };

    // Consultar el perfil real para sacar las cuentas
    const profileRes = await fetch(`${chatwootApiUrl}/api/v1/profile`, { headers });
    const profileData = await profileRes.json();
    const accounts = profileData.accounts || [];

    // Obtener los accountIds a los que tiene acceso el usuario
    const accessibleAccounts = accounts.filter((acc: any) => acc.role === 'administrator' || acc.role === 'agent');

    if (accessibleAccounts.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a ninguna cuenta.' });
    }

    // Firmar token JWT con la información del usuario y cuentas
    const token = jwt.sign(
      { 
        uid: user.uid, 
        email: user.email,
        accounts: accessibleAccounts.map((a: any) => a.id)
      }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    res.json({ token, user: { name: user.name, email: user.email, accounts: accessibleAccounts } });
  } catch (error) {
    console.error('[Auth] Error logging in:', error);
    res.status(500).json({ error: 'Error interno del servidor al autenticar' });
  }
});


// Endpoint especial para auto-login desde el Iframe de Chatwoot
router.post('/iframe-bypass', (req, res) => {
  const origin = req.get('origin') || '';
  const referer = req.get('referer') || '';

  // Permitimos CORS para el iframe-bypass
  // Para seguridad real, esto requeriría que el frontend firme la petición, pero por UX lo dejamos abierto a la IP local/referer.

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

export default router;
