require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const contactRoutes   = require('./routes/contact');
const clientRoutes    = require('./routes/clients');
const bookingRoutes   = require('./routes/bookings');
const packageRoutes   = require('./routes/packages');
const paymentRoutes   = require('./routes/payments');
const pnfRoutes       = require('./routes/pnf');
const nutritionRoutes = require('./routes/nutrition');
const adminRoutes     = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Stripe webhook needs raw body — register BEFORE json middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ── Global middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── Health check
app.get('/', (req, res) => res.json({ status: 'BAM FIT API running' }));

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
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`BAM FIT API running on port ${PORT}`));
