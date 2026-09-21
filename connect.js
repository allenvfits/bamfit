const router = require('express').Router();
const crypto = require('node:crypto');
const auth = require('./auth');
const db = require('./supabase');
const stripe = require('./stripe-client');
function safeOrigin(value,name){
  if(!value)throw new Error(`${name} is not configured`);
  const url=new URL(value);
  if(url.protocol!=='https:' && url.hostname!=='localhost')throw new Error(`${name} must use HTTPS`);
  return url.origin;
}
function frontendOrigin(){return safeOrigin(process.env.FRONTEND_URL,'FRONTEND_URL');}
function apiOrigin(){return safeOrigin(process.env.API_ORIGIN || process.env.FRONTEND_URL,'API_ORIGIN');}
async function connection(){
  const {data,error}=await db.from('bamfit_payment_connection').select('account_id,livemode').eq('id',1).maybeSingle();
  if(error)throw error;return data;
}
async function ready(id){const account=await stripe().v2.core.accounts.retrieve(id,{include:['configuration.merchant']});return account.configuration?.merchant?.capabilities?.card_payments?.status==='active';}
router.post('/start',auth,async(req,res)=>{
  if(await connection())return res.status(409).json({error:'A payment account is already connected. Contact support before changing it.'});
  if(!process.env.STRIPE_CONNECT_CLIENT_ID)return res.status(503).json({error:'Stripe Connect setup is not complete yet.'});
  const state=crypto.randomBytes(32).toString('hex');
  const expires=Date.now()+600000;
  const signed=crypto.createHmac('sha256',process.env.ADMIN_SECRET).update(state+':'+expires).digest('hex');
  res.cookie('bamfit_connect',`${state}:${expires}:${signed}`,{httpOnly:true,secure:apiOrigin().startsWith('https:'),sameSite:'none',maxAge:600000,path:'/api/connect'});
  const url=new URL('https://connect.stripe.com/oauth/authorize');
  url.search=new URLSearchParams({response_type:'code',client_id:process.env.STRIPE_CONNECT_CLIENT_ID,scope:'read_write',state,redirect_uri:apiOrigin()+'/api/connect/callback'});
  res.json({url:url.toString()});
});
router.get('/callback',async(req,res)=>{
  const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bamfit_connect='));
  const parts=raw?decodeURIComponent(raw.slice(15)).split(':'):[];
  const [state,expires,signature]=parts;
  const expected=crypto.createHmac('sha256',process.env.ADMIN_SECRET||'').update(state+':'+expires).digest('hex');
  res.clearCookie('bamfit_connect',{path:'/api/connect'});
  if(!state||req.query.state!==state||!Number.isFinite(Number(expires))||Date.now()>Number(expires)||typeof signature!=='string'||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return res.status(400).send('Connection expired or invalid. Return to the owner page and try again.');
  if(req.query.error)return res.redirect(frontendOrigin()+'/owner.html?connection=cancelled');
  if(typeof req.query.code!=='string')return res.status(400).send('Missing authorization code');
  if(await connection())return res.status(409).send('An account is already connected.');
  const result=await stripe().oauth.token({grant_type:'authorization_code',code:req.query.code});
  if(result.scope!=='read_write'||!/^acct_/.test(result.stripe_user_id||''))throw new Error('Invalid Stripe authorization');
  const {error}=await db.from('bamfit_payment_connection').insert({id:1,account_id:result.stripe_user_id,livemode:result.livemode});
  if(error)throw error;
  res.redirect(frontendOrigin()+'/owner.html?connection=connected');
});
router.get('/status',auth,async(req,res)=>{
  const account=await connection();res.json({connected:!!account,account:account?.account_id,livemode:account?.livemode,ready:account?await ready(account.account_id):false});
});
router.get('/orders',auth,async(req,res)=>{const {data,error}=await db.from('bamfit_orders').select('*').order('paid_at',{ascending:false}).limit(100);if(error)throw error;res.json(data);});
module.exports=router;module.exports.connection=connection;module.exports.ready=ready;module.exports.frontendOrigin=frontendOrigin;module.exports.apiOrigin=apiOrigin;
