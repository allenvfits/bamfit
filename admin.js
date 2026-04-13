const express   = require('express');
const router    = express.Router();
const supabase  = require('../supabase');
const adminAuth = require('../middleware/auth');

// All admin routes require the x-admin-secret header
router.use(adminAuth);

// GET /api/admin/dashboard
// Main stats for Anthony's admin dashboard
router.get('/dashboard', async (req, res) => {
  const [
    { count: totalClients },
    { count: upcomingCount },
    { count: unreadLeads },
    { count: activePackages },
    { data: recentPayments },
    { data: nextSessions },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .gte('session_date', new Date().toISOString())
      .in('status', ['pending', 'confirmed']),
    supabase.from('contact_forms').select('*', { count: 'exact', head: true })
      .eq('read', false),
    supabase.from('packages').select('*', { count: 'exact', head: true })
      .gt('credits_remaining', 0)
      .gte('expires_at', new Date().toISOString()),
    supabase.from('payments').select('amount, description, paid_at')
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(5),
    supabase.from('upcoming_bookings').select('*').limit(5),
  ]);

  // Total revenue
  const { data: revenueData } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'paid');

  const totalRevenue = revenueData
    ? revenueData.reduce((sum, p) => sum + p.amount, 0)
    : 0;

  res.json({
    stats: {
      total_clients:   totalClients  || 0,
      upcoming_sessions: upcomingCount || 0,
      unread_leads:    unreadLeads   || 0,
      active_packages: activePackages || 0,
      total_revenue:   totalRevenue,           // in cents
      total_revenue_dollars: (totalRevenue / 100).toFixed(2),
    },
    recent_payments: recentPayments || [],
    next_sessions:   nextSessions   || [],
  });
});

// GET /api/admin/leads — all unread contact form submissions
router.get('/leads', async (req, res) => {
  const { data, error } = await supabase
    .from('contact_forms')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/admin/leads/:id/read — mark a lead as read
router.patch('/leads/:id/read', async (req, res) => {
  const { data, error } = await supabase
    .from('contact_forms')
    .update({ read: true })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/admin/revenue — revenue breakdown by package type
router.get('/revenue', async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, description, paid_at')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Group by description (package type)
  const breakdown = data.reduce((acc, p) => {
    const key = p.description || 'other';
    if (!acc[key]) acc[key] = { count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += p.amount;
    return acc;
  }, {});

  res.json({
    total: data.reduce((sum, p) => sum + p.amount, 0),
    breakdown,
    payments: data,
  });
});

module.exports = router;
