// src/middlewares/authMiddleware.js
import { verifyToken } from '../services/authService.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token d\'authentification manquant.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expiré. Veuillez vous reconnecter.' });
    }
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
}
