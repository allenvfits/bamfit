require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const contactRoutes   = require('./contact');
const clientRoutes    = require('./clients');
const bookingRoutes   = require('./bookings');
const packageRoutes   = require('./packages');
const paymentRoutes   = require('./payments');
const pnfRoutes       = require('./pnf');
const nutritionRoutes = require('./nutrition');
const adminRoutes     = require('./admin');

const app  = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = new Set(
  (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'https://bamfit1.com,https://www.bamfit1.com,https://bamfit.onrender.com')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
);

// ── Stripe webhook needs raw body — register BEFORE json middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ── Global middleware
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
}));
app.use(express.json({limit:'32kb'}));
app.disable('x-powered-by');

const contactAttempts = new Map();
app.use('/api/contact', (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (contactAttempts.get(key) || []).filter(time => now - time < 15 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Please wait before sending another message.' });
  recent.push(now);
  contactAttempts.set(key, recent);
  next();
});

// ── Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));
const path = require('node:path');
const publicFiles = ['index.html','about.html','pricing.html','results.html','owner.html','checkout.html','success.html','theme.css','site.js','owner-ui.js','checkout-ui.js','bamfit-atlas-hero.webp'];
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'index.html')));
for (const file of publicFiles) app.get('/'+file,(req,res)=>res.sendFile(path.join(__dirname,file)));
app.use('/api/connect', require('./connect'));

// ── Routes
app.use('/api/contact',   contactRoutes);
app.use('/api/clients',   clientRoutes);
app.use('/api/bookings',  bookingRoutes);
app.use('/api/packages',  packageRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/pnf',       pnfRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/admin',     adminRoutes);

// ── Global error handler
app.use((err, req, res, next) => {
  console.error('Request failed:', err.code || err.name);
  res.status(500).json({ error: 'The request could not be completed. Please try again or contact Anthony.' });
});

if (require.main === module) app.listen(PORT, '0.0.0.0', () => console.log(`BAM FIT running on port ${PORT}`));
module.exports = app;
