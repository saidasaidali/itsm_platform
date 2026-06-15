// src/middlewares/roleMiddleware.js

/**
 * Middleware RBAC — authorize(...roles)
 *
 * Usage :
 *   router.get('/users', authenticate, authorize('Admin', 'Technicien'), getUsers)
 *   router.delete('/users/:id', authenticate, authorize('Admin'), deleteUser)
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Non authentifié.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle requis : ${allowedRoles.join(' ou ')}.`,
      });
    }

    next();
  };
}
