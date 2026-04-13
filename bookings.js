const express   = require('express');
const router    = express.Router();
const supabase  = require('../supabase');
const adminAuth = require('../middleware/auth');

// POST /api/bookings
// Client books a session
router.post('/', async (req, res) => {
  const { client_id, package_id, service_type, session_date, duration_mins, notes } = req.body;

  if (!client_id || !service_type || !session_date) {
    return res.status(400).json({ error: 'client_id, service_type, and session_date are required' });
  }

  // If using a package, check credits remaining
  if (package_id) {
    const { data: pkg, error: pkgErr } = await supabase
      .from('packages')
      .select('credits_remaining, expires_at')
      .eq('id', package_id)
      .single();

    if (pkgErr || !pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (pkg.credits_remaining <= 0) {
      return res.status(400).json({ error: 'No session credits remaining on this package' });
    }
    if (new Date(pkg.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This package has expired' });
    }
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert([{ client_id, package_id, service_type, session_date, duration_mins, notes }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/bookings — admin only — all upcoming bookings
router.get('/', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('upcoming_bookings')
    .select('*');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/bookings/client/:clientId — get bookings for a specific client
router.get('/client/:clientId', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('client_id', req.params.clientId)
    .order('session_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/bookings/:id/complete — admin only
// Mark session as complete and deduct one credit from the package
router.patch('/:id/complete', adminAuth, async (req, res) => {
  const { error } = await supabase.rpc('deduct_session_credit', {
    booking_id: req.params.id,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: 'Session marked complete, credit deducted' });
});

// PATCH /api/bookings/:id/cancel — admin or client
router.patch('/:id/cancel', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/bookings/:id/confirm — admin only
router.patch('/:id/confirm', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
