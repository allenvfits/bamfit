const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');
const adminAuth = require('../middleware/auth');

// POST /api/clients
// Create a new client (called on signup or first booking)
router.post('/', async (req, res) => {
  const { full_name, email, phone, goal } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // Upsert — if client already exists by email, return existing
  const { data, error } = await supabase
    .from('clients')
    .upsert([{ full_name, email, phone, goal }], { onConflict: 'email' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json(data);
});

// GET /api/clients — admin only
router.get('/', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*, packages(id, type, credits_remaining, expires_at)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/clients/:id — admin only
router.get('/:id', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      packages(*),
      bookings(*),
      pnf_appointments(*),
      nutrition_plans(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Client not found' });
  res.json(data);
});

// PATCH /api/clients/:id — admin only — update client notes/goal
router.patch('/:id', adminAuth, async (req, res) => {
  const { full_name, phone, goal, notes } = req.body;

  const { data, error } = await supabase
    .from('clients')
    .update({ full_name, phone, goal, notes })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
