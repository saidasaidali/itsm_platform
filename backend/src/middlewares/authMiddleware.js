// src/middlewares/authMiddleware.js
import { verifyToken } from '../services/authService.js';
import { t } from '../utils/i18n.js';

export function authenticate(req, res, next) {
  let token = null;

  // Essayer d'abord le header Authorization
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Sinon, essayer le query parameter (pour les téléchargements)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: t(req, 'token_missing'),
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: t(req, 'token_expired') });
    }
    return res.status(401).json({ success: false, message: t(req, 'token_invalid') });
  }
}
