const jwt = require('jsonwebtoken');

let JWT_SECRET = process.env.JWT_SECRET;
let isDefaultSecret = false;

if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is not defined. The server refuses to start in production with an insecure configuration.');
    }
    console.warn('WARNING: JWT_SECRET environment variable is not defined. Using default insecure secret.');
    JWT_SECRET = 'CHANGE_ME_IN_PROD_PLEASE';
    isDefaultSecret = true;
}

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Middleware to verify Admin Role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Admins only.' });
  }
};

module.exports = { authenticateToken, requireAdmin, JWT_SECRET, isDefaultSecret };
