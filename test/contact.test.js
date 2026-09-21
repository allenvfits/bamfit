const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const originalFetch = global.fetch;
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  OWNER_EMAIL: process.env.OWNER_EMAIL,
};

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('Resend notification uses the BAM FIT sender and customer reply-to', async () => {
  process.env.RESEND_API_KEY = 'test_resend_key';
  process.env.RESEND_FROM_EMAIL = 'contact@bamfit1.com';
  process.env.OWNER_EMAIL = 'contact@bamfit1.com';

  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: 'email_test' }) };
  };

  const { sendOwnerNotification } = require('../contact');
  await sendOwnerNotification({
    full_name: 'Test Customer',
    email: 'customer@example.com',
    phone: '555-0100',
    interest: 'Strength',
    message: 'I would like to train.',
  });

  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer test_resend_key');
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.from, 'BAM FIT Website <contact@bamfit1.com>');
  assert.deepEqual(payload.to, ['contact@bamfit1.com']);
  assert.equal(payload.reply_to, 'customer@example.com');
  assert.equal(payload.tags[0].value, 'bamfit_website');
});

test('contact validation rejects missing or malformed email addresses', () => {
  const { normalizeLead } = require('../contact');
  assert.throws(() => normalizeLead({ full_name: 'Test', email: 'not-an-email' }), /valid email/);
  assert.throws(() => normalizeLead({ email: 'customer@example.com' }), /Name/);
});

test('Resend configuration fails closed when the API key is missing', async () => {
  delete process.env.RESEND_API_KEY;
  const { sendOwnerNotification } = require('../contact');
  await assert.rejects(
    sendOwnerNotification({
      full_name: 'Test Customer',
      email: 'customer@example.com',
      phone: '',
      interest: '',
      message: '',
    }),
    error => error.statusCode === 503,
  );
});
