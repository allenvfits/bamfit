const express   = require('express');
const router    = express.Router();
const supabase  = require('../supabase');
const adminAuth = require('../middleware/auth');

// POST /api/pnf
// Book a PNF stretching appointment
router.post('/', async (req, res) => {
  const { client_id, session_length, session_date, notes } = req.body;

  if (!client_id || !session_length || !session_date) {
    return res.status(400).json({ error: 'client_id, session_length, and session_date are required' });
  }

  const PRICES = { intro_20: 2000, session_25: 2500, session_50: 4000 };
  const amount_paid = PRICES[session_length];

  if (!amount_paid) {
    return res.status(400).json({ error: 'Invalid session_length. Use: intro_20, session_25, session_50' });
  }

  const { data, error } = await supabase
    .from('pnf_appointments')
    .insert([{ client_id, session_length, amount_paid, session_date, notes }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/pnf — admin only — all upcoming PNF appointments
router.get('/', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('pnf_appointments')
    .select('*, clients(full_name, email, phone)')
    .gte('session_date', new Date().toISOString())
    .order('session_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/pnf/:id/confirm — admin only
router.patch('/:id/confirm', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('pnf_appointments')
    .update({ status: 'confirmed' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/pnf/:id/complete — admin only
router.patch('/:id/complete', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('pnf_appointments')
    .update({ status: 'completed' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
