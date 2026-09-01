import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@6.1.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') || 'com.dramarush.app';
const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!;

const admin = createClient(supabaseUrl, serviceRoleKey);

async function googleAccessToken() {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google token error: ${await res.text()}`);
  return (await res.json()).access_token as string;
}

async function verifyGooglePurchase(productId: string, token: string, type: 'product' | 'subscription') {
  const access = await googleAccessToken();
  const url = type === 'product'
    ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`
    : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  if (!res.ok) throw new Error(`Google purchase verification failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.replace(/^Bearer\s+/i, '');
    if (!jwt) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const productId = String(body.productId || '');
    const purchaseToken = String(body.purchaseToken || '');
    const productKind = body.productKind === 'subscription' ? 'subscription' : 'product';
    if (!productId || !purchaseToken) return Response.json({ error: 'Missing productId or purchaseToken' }, { status: 400 });

    const purchase = await verifyGooglePurchase(productId, purchaseToken, productKind);
    let referenceId = purchase.orderId || purchase.latestOrderId || purchase.purchaseToken || purchaseToken;
    let expiryDate: string | null = null;

    if (productKind === 'product') {
      if (purchase.purchaseState !== 0) return Response.json({ error: 'Purchase is not completed', state: purchase.purchaseState }, { status: 409 });
      if (purchase.consumptionState === 1) {
        return Response.json({ error: 'Purchase already consumed' }, { status: 409 });
      }
    } else {
      const state = purchase.subscriptionState;
      if (state !== 'SUBSCRIPTION_STATE_ACTIVE' && state !== 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
        return Response.json({ error: 'Subscription is not active', state }, { status: 409 });
      }
      referenceId = purchase.latestOrderId || purchaseToken;
      expiryDate = purchase.lineItems?.[0]?.expiryTime || null;
    }

    const { data: product } = await admin.from('store_products').select('price_usd,kind').eq('product_id', productId).single();
    if (!product || (productKind === 'subscription' ? product.kind !== 'subscription' : product.kind !== 'coins')) {
      return Response.json({ error: 'Product mismatch' }, { status: 400 });
    }

    const { data, error } = await admin.rpc('grant_verified_purchase', {
      p_user_id: userData.user.id,
      p_product_id: productId,
      p_reference_id: referenceId,
      p_amount: product.price_usd,
      p_store: 'google_play',
      p_expiry_date: expiryDate,
    });
    if (error) throw error;

    return Response.json(data);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Purchase verification failed' }, { status: 500 });
  }
});
