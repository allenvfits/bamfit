const router=require('express').Router();
const stripe=require('./stripe-client');
const db=require('./supabase');
const PRICES=require('./prices');
const {connection,ready,frontendOrigin}=require('./connect');
router.get('/catalog',(req,res)=>res.json(Object.entries(PRICES).filter(([id])=>id!=='nutrition').map(([id,value])=>({id,...value}))));
router.post('/create-checkout',async(req,res)=>{
  const {package_type,client_email,client_name}=req.body;
  const price=Object.hasOwn(PRICES,package_type)?PRICES[package_type]:null;
  if(!price||package_type==='nutrition')return res.status(400).json({error:'Please contact Anthony to arrange this service.'});
  if(typeof client_email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)||client_email.length>254||typeof client_name!=='string'||!client_name.trim()||client_name.length>120)return res.status(400).json({error:'Enter your name and valid email.'});
  const account=await connection();
  if(!account||!await ready(account.account_id))return res.status(503).json({error:'Online payments are not ready. Please contact Anthony to book.'});
  const session=await stripe().checkout.sessions.create({
    mode:'payment',integration_identifier:'bamfit_checkout_hkqmvzrt',customer_email:client_email,
    line_items:[{price_data:{currency:'usd',product_data:{name:price.label},unit_amount:price.amount},quantity:1}],
    metadata:{site:'bamfit',package_type,client_name:client_name.trim(),client_email},
    success_url:frontendOrigin()+'/success.html',cancel_url:frontendOrigin()+'/checkout.html',
  },{stripeAccount:account.account_id});
  res.json({url:session.url});
});
router.post('/webhook',async(req,res)=>{
  let event;
  try{event=stripe().webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}catch{return res.status(400).send('Invalid webhook signature');}
  const account=await connection();
  if(!account||event.account!==account.account_id||event.livemode!==account.livemode)return res.status(400).send('Unexpected payment account');
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    const session=event.data.object,meta=session.metadata||{},price=PRICES[meta.package_type];
    if(meta.site!=='bamfit')return res.json({received:true});
    if(session.payment_status!=='paid')return res.json({received:true});
    if(!price||session.currency!=='usd'||session.amount_total!==price.amount)return res.status(400).send('Unexpected payment amount');
    const {error}=await db.rpc('record_bamfit_order',{
      p_stripe_session_id:session.id,
      p_account_id:event.account,
      p_package_type:meta.package_type,
      p_client_name:meta.client_name,
      p_client_email:session.customer_details?.email||meta.client_email,
      p_amount:session.amount_total,
      p_stripe_payment_id:session.payment_intent,
      p_paid_at:new Date(event.created*1000).toISOString(),
    });
    if(error)throw error;
  }
  res.json({received:true});
});
module.exports=router;
