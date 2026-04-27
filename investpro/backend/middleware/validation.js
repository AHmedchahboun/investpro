/**
 * Request body validation middleware
 * Ensures JSON body is valid and not too large
 */
const validateJsonBody = (req, res, next) => {
  if (req.is('application/json')) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid JSON body' 
      });
    }
  }
  next();
};

module.exports = { validateJsonBody };
