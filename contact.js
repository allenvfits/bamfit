const express = require('express');
const router = express.Router();

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'contact@bamfit1.com';
const DEFAULT_OWNER_EMAIL = 'contact@bamfit1.com';

function clean(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength)
    : '';
}

function normalizeLead(body = {}) {
  const lead = {
    full_name: clean(body.full_name, 120),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 40),
    interest: clean(body.interest, 120),
    message: clean(body.message, 5000),
  };

  if (!lead.full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    const error = new Error('Name and a valid email are required');
    error.statusCode = 400;
    throw error;
  }

  return lead;
}

async function saveLead(lead) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabase = require('./supabase');
  const { data, error } = await supabase
    .from('contact_forms')
    .insert([lead])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function sendOwnerNotification(lead) {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error('Email service is not configured');
    error.statusCode = 503;
    throw error;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const ownerEmail = process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL;
  const safeSubjectName = lead.full_name.replace(/[\r\n]+/g, ' ');
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `BAM FIT Website <${fromEmail}>`,
      to: [ownerEmail],
      reply_to: lead.email,
      subject: `New BAM FIT Lead: ${safeSubjectName}`,
      text: `Name: ${lead.full_name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nInterest: ${lead.interest}\nMessage: ${lead.message}`,
      tags: [{ name: 'source', value: 'bamfit_website' }],
    }),
  });

  if (!response.ok) {
    const error = new Error(`Resend request failed with status ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  return response.json();
}

// POST /api/contact
// Called when someone submits the contact form on the website
router.post('/', async (req, res) => {
  try {
    const lead = normalizeLead(req.body);
    const [savedResult, emailResult] = await Promise.allSettled([
      saveLead(lead),
      sendOwnerNotification(lead),
    ]);

    if (savedResult.status === 'rejected') {
      console.error('Contact database save failed:', savedResult.reason.message);
    }
    if (emailResult.status === 'rejected') throw emailResult.reason;

    const savedLead = savedResult.status === 'fulfilled' ? savedResult.value : null;
    return res.status(201).json({ success: true, id: savedLead?.id || null });
  } catch (error) {
    console.error('Contact request failed:', error.message);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode === 400
        ? error.message
        : 'Your message could not be sent. Please email contact@bamfit1.com.',
    });
  }
});

module.exports = router;
module.exports.normalizeLead = normalizeLead;
module.exports.sendOwnerNotification = sendOwnerNotification;
