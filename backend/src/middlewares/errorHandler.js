// backend/src/middlewares/errorHandler.js

export const errorHandler = (err, req, res, next) => {
  console.error('[ErrorHandler] Error caught:', err);
  const status = err.statusCode || 500;
  res.status(status).json({ 
    success: false, 
    message: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
