// src/middlewares/authMiddleware.js
import { verifyToken } from '../services/authService.js';
import { t } from '../utils/i18n.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: t(req, 'token_missing'),
    });
  }

  const token = authHeader.split(' ')[1];

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
