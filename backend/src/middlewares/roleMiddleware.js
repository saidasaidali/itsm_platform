// src/middlewares/roleMiddleware.js
import { t } from '../utils/i18n.js';

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: t(req, 'not_authenticated') });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: t(req, 'role_required', { roles: allowedRoles.join(' / ') }),
      });
    }

    next();
  };
}
