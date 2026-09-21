require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const defaultOrigins = [
  'https://bamfit1.com',
  'https://www.bamfit1.com',
  'https://bamfit.onrender.com',
];
const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || defaultOrigins.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const requestCounts = new Map();

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed'));
  },
}));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/contact', (req, res, next) => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (requestCounts.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  if (recent.length >= 5) return res.status(429).json({ error: 'Please wait before sending another message.' });
  recent.push(now);
  requestCounts.set(key, recent);
  next();
});
app.use('/api/contact', require('./contact'));

app.use((err, req, res, next) => {
  console.error('Contact API request failed:', err.code || err.name);
  res.status(500).json({ error: 'The request could not be completed.' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`BAM FIT contact API running on port ${PORT}`));
}

module.exports = app;
