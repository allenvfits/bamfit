const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
process.env.ADMIN_SECRET='test-owner-secret';process.env.FRONTEND_URL='http://localhost:4000';process.env.STRIPE_CONNECT_CLIENT_ID='ca_test';
let account=null,active=false,event,created,orders=new Map();
const db={from(table){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:account};},async upsert(value){if(!orders.has(value.stripe_session_id))orders.set(value.stripe_session_id,value);return {};}};}};
require.cache[require.resolve('../supabase')]={exports:db};
require.cache[require.resolve('../stripe-client')]={exports:()=>({v2:{core:{accounts:{retrieve:async()=>({configuration:{merchant:{capabilities:{card_payments:{status:active?'active':'inactive'}}}}})}}},checkout:{sessions:{create:async(params,options)=>{created={params,options};return {url:'https://checkout.stripe.com/test'};}}},webhooks:{constructEvent:()=>{if(!event)throw Error('bad signature');return event;}}})};
const app=require('../server');let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});after(()=>server.close());
const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('checkout fails closed before account connection and readiness',async()=>{
 const body={package_type:'6_sessions',client_email:'customer@example.com',client_name:'Customer'};
 assert.equal((await post('/api/payments/create-checkout',body)).status,503);
 account={account_id:'acct_owner',livemode:false};
 assert.equal((await post('/api/payments/create-checkout',body)).status,503);
 active=true;assert.equal((await post('/api/payments/create-checkout',body)).status,200);
 assert.equal(created.options.stripeAccount,'acct_owner');assert.equal(created.params.line_items[0].price_data.unit_amount,26500);
 assert.equal(created.params.metadata.client_id,undefined);assert.equal(created.params.payment_method_types,undefined);
});
test('owner and customer-record endpoints reject unauthenticated changes',async()=>{for(const path of ['/api/connect/start','/api/packages','/api/clients','/api/bookings','/api/pnf'])assert.equal((await post(path,{})).status,401);});
test('webhook verifies signature, account, payment state and deduplicates session',async()=>{
 assert.equal((await post('/api/payments/webhook',{})).status,400);
 event={type:'checkout.session.completed',account:'acct_wrong',livemode:false,created:1700000000,data:{object:{id:'cs_1',metadata:{site:'bamfit',package_type:'6_sessions'},amount_total:26500,currency:'usd',payment_status:'paid'}}};
 assert.equal((await post('/api/payments/webhook',{})).status,400);assert.equal(orders.size,0);
 event.account='acct_owner';event.data.object.payment_status='unpaid';assert.equal((await post('/api/payments/webhook',{})).status,200);assert.equal(orders.size,0);
 event.data.object.payment_status='paid';assert.equal((await post('/api/payments/webhook',{})).status,200);assert.equal((await post('/api/payments/webhook',{})).status,200);assert.equal(orders.size,1);
});
test('public assets work without exposing source or setup files',async()=>{for(const path of ['/','/about.html','/pricing.html','/results.html','/checkout.html','/owner.html','/success.html','/theme.css'])assert.equal((await fetch(base+path)).status,200);for(const path of ['/server.js','/supabase.js','/setup.sql','/.env'])assert.equal((await fetch(base+path)).status,404);});
test('OAuth rejects a callback without matching browser state',async()=>{assert.equal((await fetch(base+'/api/connect/callback?code=attacker&state=forged')).status,400);});
