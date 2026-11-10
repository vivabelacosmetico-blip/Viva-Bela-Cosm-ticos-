import express from 'express';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.static('public'));
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERCADOPAGO_ACCESS_TOKEN, ADMIN_PASSWORD, SITE_URL, PORT = 3000 } = process.env;
const configured = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;
const db = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
const money = n => Number(n).toFixed(2);

app.get('/api/health', (_req,res) => res.json({ ok:true, database:!!db, payments:!!MERCADOPAGO_ACCESS_TOKEN }));
app.get('/api/products', async (_req,res) => {
  if (!db) return res.status(503).json({error:'Banco de dados ainda não configurado.'});
  const {data,error}=await db.from('products').select('id,name,description,price,image_url,stock,active').eq('active',true).order('created_at',{ascending:false});
  if(error) return res.status(500).json({error:error.message}); res.json(data);
});
app.post('/api/admin/products', async (req,res) => {
  if (!ADMIN_PASSWORD || req.get('x-admin-password') !== ADMIN_PASSWORD) return res.status(401).json({error:'Acesso não autorizado.'});
  if (!db) return res.status(503).json({error:'Banco de dados ainda não configurado.'});
  const {name,description='',price,image_url='',stock=0}=req.body;
  if(!name || !Number.isFinite(Number(price)) || Number(price)<=0) return res.status(400).json({error:'Informe nome e preço válido.'});
  const {data,error}=await db.from('products').insert({name,description,price:Number(price),image_url,stock:Number(stock),active:true}).select().single();
  if(error) return res.status(500).json({error:error.message}); res.status(201).json(data);
});
app.post('/api/checkout', async (req,res) => {
  if (!db || !MERCADOPAGO_ACCESS_TOKEN) return res.status(503).json({error:'Pagamento ainda não está configurado.'});
  const {items,customer}=req.body;
  if(!Array.isArray(items)||!items.length||!customer?.name||!customer?.email) return res.status(400).json({error:'Carrinho ou dados do cliente incompletos.'});
  const ids=items.map(i=>i.id);
  const {data:products,error}=await db.from('products').select('id,name,price,stock,active').in('id',ids);
  if(error||!products||products.length!==new Set(ids).size) return res.status(400).json({error:'Produto inválido.'});
  const lines=[]; let total=0;
  for(const item of items){const p=products.find(x=>x.id===item.id); const qty=Math.max(1,Math.min(20,Number(item.quantity)||1)); if(!p?.active||p.stock<qty) return res.status(400).json({error:`Estoque insuficiente: ${p?.name||'produto'}`}); total+=Number(p.price)*qty; lines.push({title:p.name,quantity:qty,unit_price:money(p.price)});}
  const external_reference=crypto.randomUUID();
  const {data:order,error:dbErr}=await db.from('orders').insert({external_reference,customer_name:customer.name,customer_email:customer.email,customer_phone:customer.phone||'',shipping_address:customer.address||'',items,total_amount:money(total),status:'pending'}).select().single();
  if(dbErr) return res.status(500).json({error:dbErr.message});
  const mp=await fetch('https://api.mercadopago.com/v1/orders',{method:'POST',headers:{Authorization:`Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,'Content-Type':'application/json','X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({type:'online',processing_mode:'manual',capture_mode:'automatic_async',total_amount:money(total),external_reference,description:'Compra Viva Bela Cosméticos',payer:{email:customer.email},items:lines,config:{online:{callback_url:SITE_URL}}})});
  const result=await mp.json();
  if(!mp.ok||!result.checkout_url){await db.from('orders').update({status:'payment_error',payment_data:result}).eq('id',order.id);return res.status(502).json({error:'Não foi possível iniciar o pagamento.',detail:result.message||result.error});}
  await db.from('orders').update({mercadopago_order_id:result.id}).eq('id',order.id);
  res.json({checkout_url:result.checkout_url,order_id:order.id});
});
app.post('/api/mercadopago/webhook', async (req,res) => {
  // Configure a URL HTTPS deste endpoint no painel do Mercado Pago.
  // Em produção, valide a assinatura x-signature conforme a documentação oficial antes de processar eventos.
  const dataId=req.query['data.id'] || req.body?.data?.id;
  if(dataId && db){const r=await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`,{headers:{Authorization:`Bearer ${MERCADOPAGO_ACCESS_TOKEN}`}}); const order=await r.json(); if(r.ok && order.external_reference){const status=order.status==='processed'?'paid':order.status==='cancelled'?'cancelled':'pending'; await db.from('orders').update({status,payment_data:order}).eq('external_reference',order.external_reference);}}
  res.sendStatus(200);
});
app.get('/api/admin/orders', async (req,res)=>{
  if (!ADMIN_PASSWORD || req.get('x-admin-password') !== ADMIN_PASSWORD) return res.status(401).json({error:'Acesso não autorizado.'});
  if(!db) return res.status(503).json({error:'Banco de dados não configurado.'});
  const {data,error}=await db.from('orders').select('*').order('created_at',{ascending:false}).limit(100); if(error)return res.status(500).json({error:error.message});res.json(data);
});
app.listen(PORT,()=>console.log(`Viva Bela rodando na porta ${PORT}`));
