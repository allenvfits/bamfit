const express   = require('express');
const router    = express.Router();
const supabase  = require('../supabase');
const adminAuth = require('../middleware/auth');

// POST /api/nutrition
// Enroll a client in the nutrition add-on
router.post('/', adminAuth, async (req, res) => {
  const { client_id, meal_plan, supplements, notes } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' });
  }

  const { data, error } = await supabase
    .from('nutrition_plans')
    .insert([{ client_id, meal_plan, supplements, notes, amount_paid: 10000 }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/nutrition — admin only — all active nutrition plans
router.get('/', adminAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('nutrition_plans')
    .select('*, clients(full_name, email)')
    .eq('active', true)
    .order('start_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/nutrition/:id — admin only — update meal plan or supplements
router.patch('/:id', adminAuth, async (req, res) => {
  const { meal_plan, supplements, notes, active } = req.body;

  const { data, error } = await supabase
    .from('nutrition_plans')
    .update({ meal_plan, supplements, notes, active })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
