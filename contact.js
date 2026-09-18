const express    = require('express');
const router     = express.Router();
const supabase   = require('./supabase');
const nodemailer = require('nodemailer');

// Email transporter — uses Gmail app password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /api/contact
// Called when someone submits the contact form on the website
router.post('/', async (req, res) => {
  const { full_name, email, phone, interest, message } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // 1. Save to Supabase
  const { data, error } = await supabase
    .from('contact_forms')
    .insert([{ full_name, email, phone, interest, message }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // 2. Email Anthony a notification
  try {
    await transporter.sendMail({
      from: `"BAM FIT Website" <${process.env.EMAIL_USER}>`,
      to: process.env.OWNER_EMAIL || 'abiacono@gmail.com',
      subject: `New BAM FIT Lead: ${full_name}`,
      text: `Name: ${full_name}\nEmail: ${email}\nPhone: ${phone || ''}\nInterest: ${interest || ''}\nMessage: ${message || ''}`,
    });
  } catch (emailErr) {
    // Don't fail the request if email fails — lead is still saved
    console.error('Email notification failed:', emailErr.message);
  }

  res.status(201).json({ success: true, id: data.id });
});

module.exports = router;
