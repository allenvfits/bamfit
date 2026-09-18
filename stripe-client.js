const Stripe = require('stripe');
let client;
module.exports = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');
  return client ||= new Stripe(process.env.STRIPE_SECRET_KEY, {apiVersion:'2026-07-29.dahlia'});
};
