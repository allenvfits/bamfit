const express  = require('express');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../supabase');

// Stripe price map — amounts in cents
const PRICES = {
  '6_sessions':  { amount: 26500, label: '6 Session Package — BAM FIT' },
  '10_sessions': { amount: 42000, label: '10 Session Package — BAM FIT' },
  '15_sessions': { amount: 60000, label: '15 Session Package — BAM FIT' },
  '25_sessions': { amount: 95200, label: '25 Session Package — BAM FIT (Best Value)' },
  'custom_3day': { amount: 8000,  label: '3-Day Custom Routine — BAM FIT' },
  'custom_5day': { amount: 15000, label: '5-Day Custom Routine — BAM FIT' },
  'payday_30':   { amount: 2500,  label: '30-Min Drop-In Session — BAM FIT' },
  'payday_55':   { amount: 4500,  label: '55-Min Drop-In Session — BAM FIT' },
  'pnf_intro':   { amount: 2000,  label: 'PNF Intro Stretch — BAM FIT' },
  'pnf_25':      { amount: 2500,  label: 'PNF 25-Min Session — BAM FIT' },
  'pnf_50':      { amount: 4000,  label: 'PNF 50-Min Session — BAM FIT' },
  'nutrition':   { amount: 10000, label: 'Nutrition & Supplementation Add-On — BAM FIT' },
};

// POST /api/payments/create-checkout
// Creates a Stripe Checkout session and returns the URL
router.post('/create-checkout', async (req, res) => {
  const { package_type, client_email, client_name, client_id } = req.body;

  const price = PRICES[package_type];
  if (!price) {
    return res.status(400).json({ error: `Unknown package type: ${package_type}` });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: client_email,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: price.label },
        unit_amount: price.amount,
      },
      quantity: 1,
    }],
    metadata: {
      package_type,
      client_id:   client_id   || '',
      client_name: client_name || '',
      client_email: client_email || '',
    },
    success_url: `${process.env.FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.FRONTEND_URL}/pricing.html`,
  });

  res.json({ url: session.url });
});

// POST /api/payments/webhook
// Stripe calls this automatically after a successful payment
// Raw body middleware is applied in server.js BEFORE this route
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object;
    const meta     = session.metadata;
    const pkg_type = meta.package_type;

    // 1. Ensure client exists
    let clientId = meta.client_id;

    if (!clientId) {
      const { data: client } = await supabase
        .from('clients')
        .upsert([{ full_name: meta.client_name, email: meta.client_email }], { onConflict: 'email' })
        .select()
        .single();
      clientId = client?.id;
    }

    // 2. Save payment record
    await supabase.from('payments').insert([{
      client_id:        clientId,
      amount:           session.amount_total,
      stripe_payment_id: session.payment_intent,
      stripe_session_id: session.id,
      status:           'paid',
      description:      pkg_type,
    }]);

    // 3. Create package or PNF appointment or nutrition plan
    const PACKAGE_TYPES = ['6_sessions','10_sessions','15_sessions','25_sessions','custom_3day','custom_5day','payday_30','payday_55'];
    const PNF_TYPES     = ['pnf_intro','pnf_25','pnf_50'];
    const PNF_MAP       = { pnf_intro: 'intro_20', pnf_25: 'session_25', pnf_50: 'session_50' };
    const SESSION_MAP   = { '6_sessions':6,'10_sessions':10,'15_sessions':15,'25_sessions':25,'custom_3day':1,'custom_5day':1,'payday_30':1,'payday_55':1 };

    if (PACKAGE_TYPES.includes(pkg_type)) {
      await supabase.from('packages').insert([{
        client_id:         clientId,
        type:              pkg_type,
        total_sessions:    SESSION_MAP[pkg_type],
        credits_remaining: SESSION_MAP[pkg_type],
        amount_paid:       session.amount_total,
        stripe_payment_id: session.payment_intent,
      }]);
    }

    if (PNF_TYPES.includes(pkg_type)) {
      await supabase.from('pnf_appointments').insert([{
        client_id:      clientId,
        session_length: PNF_MAP[pkg_type],
        amount_paid:    session.amount_total,
        session_date:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // placeholder: 1 week out
        status:         'pending',
      }]);
    }

    if (pkg_type === 'nutrition') {
      await supabase.from('nutrition_plans').insert([{
        client_id:   clientId,
        amount_paid: session.amount_total,
        active:      true,
      }]);
    }

    console.log(`Payment complete: ${pkg_type} for ${meta.client_email}`);
  }

  res.json({ received: true });
});

module.exports = router;
