// Webshop → platform: WooCommerce order webhook (order.created + order.updated).
// Verifies the WooCommerce HMAC signature, stores the order and links it to the account with the
// same e-mail (accounts created later pick up earlier orders via the on_auth_user_created trigger).
//
// Secrets (supabase secrets set …): WC_WEBHOOK_SECRET, SHOP_ID (e.g. "naturesfinest-si")
// Deploy: supabase functions deploy shop-order --no-verify-jwt   (WooCommerce can't send a Supabase JWT;
// the HMAC signature is the authentication)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SECRET = Deno.env.get('WC_WEBHOOK_SECRET') ?? '';
const SHOP = Deno.env.get('SHOP_ID') ?? 'naturesfinest';

async function validSignature(body: string, sig: string | null): Promise<boolean> {
  if (!sig || !SECRET) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);   // constant time
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const body = await req.text();
  // WooCommerce sends a form-encoded ping when the webhook is created
  if (body.startsWith('webhook_id=')) return new Response('ok');
  if (!(await validSignature(body, req.headers.get('x-wc-webhook-signature')))) return new Response('bad signature', { status: 401 });

  const o = JSON.parse(body);
  const email = String(o?.billing?.email ?? '').trim().toLowerCase();
  if (!o?.id || !email) return new Response('ignored', { status: 202 });

  const { data: uid } = await db.rpc('user_id_by_email', { p_email: email });
  const row = {
    shop: SHOP,
    order_id: String(o.id),
    user_id: uid ?? null,
    email,
    status: o.status ?? null,
    total: o.total != null ? Number(o.total) : null,
    currency: o.currency ?? 'EUR',
    items: (o.line_items ?? []).map((i: { sku?: string; name?: string; quantity?: number; product_id?: number }) =>
      ({ sku: i.sku || String(i.product_id ?? ''), name: i.name ?? '', qty: i.quantity ?? 1 })),
    ordered_at: o.date_created_gmt ? o.date_created_gmt + 'Z' : null,
  };
  const { error } = await db.from('orders').upsert(row, { onConflict: 'shop,order_id' });
  if (error) return new Response(error.message, { status: 500 });
  return new Response('ok');
});
