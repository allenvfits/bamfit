const crypto = require('node:crypto');

function adminAuth(req, res, next) {
  const supplied = req.headers['x-admin-secret'];
  const configured = process.env.ADMIN_SECRET;
  if (typeof supplied !== 'string' || typeof configured !== 'string' || configured.length < 24) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const suppliedBuffer = Buffer.from(supplied);
  const configuredBuffer = Buffer.from(configured);
  if (suppliedBuffer.length !== configuredBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, configuredBuffer)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = adminAuth;
