import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zabotek-super-secret-key-2026';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta el token de autorización.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Si la ruta incluye :accountId, verificar que el usuario tenga acceso a esa cuenta
    const requestedAccountId = req.params.accountId;
    if (requestedAccountId) {
      const accId = parseInt(requestedAccountId as string, 10);
      if (!decoded.accounts.includes(accId)) {
        return res.status(403).json({ error: 'No tienes permisos para ver esta cuenta.' });
      }
    }

    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};
