const express   = require('express');
const router    = express.Router();
const supabase  = require('./supabase');
const adminAuth = require('./auth');

// Package config — matches Supabase check constraint
const PACKAGE_CONFIG = {
  '10_sessions': { total_sessions: 10, amount_paid: 42000  }, // $420
  '15_sessions': { total_sessions: 15, amount_paid: 60000  }, // $600
  '25_sessions': { total_sessions: 25, amount_paid: 95200  }, // $952
};

// POST /api/packages
// Called automatically after a successful Stripe payment
router.post('/', adminAuth, async (req, res) => {
  const { client_id, type, stripe_payment_id } = req.body;

  if (!client_id || !type) {
    return res.status(400).json({ error: 'client_id and type are required' });
  }

  const config = PACKAGE_CONFIG[type];
  if (!config) {
    return res.status(400).json({ error: `Unknown package type: ${type}` });
  }

  const { data, error } = await supabase
    .from('packages')
    .insert([{
      client_id,
      type,
      total_sessions:    config.total_sessions,
      credits_remaining: config.total_sessions,
      amount_paid:       config.amount_paid,
      stripe_payment_id,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/packages/client/:clientId — get all packages for a client
router.get('/client/:clientId', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('client_id', req.params.clientId)
    .order('purchased_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/packages/active — admin only — all active packages
router.get('/active', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('active_packages')
    .select('*');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
