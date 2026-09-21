const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
process.env.ADMIN_SECRET='test-owner-secret-long-enough';process.env.FRONTEND_URL='http://localhost:4000';process.env.API_ORIGIN='http://localhost:4000';process.env.STRIPE_CONNECT_CLIENT_ID='ca_test';
let account=null,active=false,event,created,inserted,orders=new Map();
const db={from(table){const query={select(){return query;},eq(){return query;},insert(rows){inserted={table,rows};return query;},async single(){return {data:inserted?.rows?.[0]||null};},async maybeSingle(){return {data:account};}};return query;},async rpc(name,value){if(name==='record_bamfit_order'&&!orders.has(value.p_stripe_session_id))orders.set(value.p_stripe_session_id,value);return {};}};
require.cache[require.resolve('../supabase')]={exports:db};
require.cache[require.resolve('../stripe-client')]={exports:()=>({v2:{core:{accounts:{retrieve:async()=>({configuration:{merchant:{capabilities:{card_payments:{status:active?'active':'inactive'}}}}})}}},checkout:{sessions:{create:async(params,options)=>{created={params,options};return {url:'https://checkout.stripe.com/test'};}}},webhooks:{constructEvent:()=>{if(!event)throw Error('bad signature');return event;}}})};
const app=require('../server');let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});after(()=>server.close());
const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('checkout fails closed before account connection and readiness',async()=>{
 const body={package_type:'10_sessions',client_email:'customer@example.com',client_name:'Customer'};
 assert.equal((await post('/api/payments/create-checkout',body)).status,503);
 account={account_id:'acct_owner',livemode:false};
 assert.equal((await post('/api/payments/create-checkout',body)).status,503);
 active=true;assert.equal((await post('/api/payments/create-checkout',body)).status,200);
 assert.equal(created.options.stripeAccount,'acct_owner');assert.equal(created.params.line_items[0].price_data.unit_amount,42000);
 assert.equal(created.params.metadata.client_id,undefined);assert.equal(created.params.payment_method_types,undefined);
});
test('only Anthony-approved training packages are available',async()=>{
 const catalog=await (await fetch(base+'/api/payments/catalog')).json();
 const ids=catalog.map(entry=>entry.id);
 assert.deepEqual(ids.sort(),['6_sessions','10_sessions','15_sessions'].sort());
 for(const retired of ['25_sessions','payday_30','payday_55','custom_3day','custom_5day','pnf_intro','pnf_25','pnf_50','intro_25','session_25','session_50','nutrition']){
  assert.ok(!ids.includes(retired));
  assert.equal((await post('/api/payments/create-checkout',{package_type:retired,client_email:'customer@example.com',client_name:'Customer'})).status,400);
 }
});
test('owner and customer-record endpoints reject unauthenticated changes',async()=>{for(const path of ['/api/connect/start','/api/packages','/api/clients','/api/bookings','/api/pnf'])assert.equal((await post(path,{})).status,401);});
test('PNF appointment records use Anthony-approved prices',async()=>{
 for(const [session_length,amount] of [['intro_25',2500],['session_25',3500],['session_50',6000]]){
  inserted=null;
  const response=await post('/api/pnf',{client_id:'client-id',session_length,session_date:'2026-10-01T18:00:00Z'},{'x-admin-secret':process.env.ADMIN_SECRET});
  assert.equal(response.status,201);
  assert.equal(inserted.table,'pnf_appointments');
  assert.equal(inserted.rows[0].amount_paid,amount);
 }
});
test('webhook verifies signature, account, payment state and deduplicates session',async()=>{
 assert.equal((await post('/api/payments/webhook',{})).status,400);
 event={type:'checkout.session.completed',account:'acct_wrong',livemode:false,created:1700000000,data:{object:{id:'cs_1',metadata:{site:'bamfit',package_type:'10_sessions'},amount_total:42000,currency:'usd',payment_status:'paid'}}};
 assert.equal((await post('/api/payments/webhook',{})).status,400);assert.equal(orders.size,0);
 event.account='acct_owner';event.data.object.payment_status='unpaid';assert.equal((await post('/api/payments/webhook',{})).status,200);assert.equal(orders.size,0);
 event.data.object.payment_status='paid';assert.equal((await post('/api/payments/webhook',{})).status,200);assert.equal((await post('/api/payments/webhook',{})).status,200);assert.equal(orders.size,1);
});
test('public assets work without exposing source or setup files',async()=>{for(const path of ['/','/about.html','/pricing.html','/results.html','/checkout.html','/owner.html','/success.html','/theme.css'])assert.equal((await fetch(base+path)).status,200);for(const path of ['/server.js','/supabase.js','/setup.sql','/.env'])assert.equal((await fetch(base+path)).status,404);});
test('OAuth rejects a callback without matching browser state',async()=>{assert.equal((await fetch(base+'/api/connect/callback?code=attacker&state=forged')).status,400);});
test('client package records require owner authorization',async()=>{
 assert.equal((await fetch(base+'/api/packages/client/example-client')).status,401);
});
