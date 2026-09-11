// Module-level token cache (survives warm Lambda invocations)
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET environment variables');
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OAuth failed (${resp.status}): ${body}`);
  }
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 300) * 1000;
  console.log('[proxy] Got eBay token, expires in', data.expires_in, 'seconds');
  return cachedToken;
}

export default async function handler(req, res) {
  const q = req.query.q || '';
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  if (!q) return res.status(400).json({ error: 'Missing q parameter' });
  console.log('[proxy] Search:', q, 'limit:', limit);

  try {
    const token = await getAccessToken();

    const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');
    url.searchParams.set('sort', 'price');
    console.log('[proxy] Browse API URL:', url.toString());

    const resp = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      }
    });

    const body = await resp.text();
    console.log('[proxy] Browse API status:', resp.status, 'body:', body.substring(0, 300));

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Browse API error' });
    }

    const data = JSON.parse(body);
    const now = new Date().toISOString();
    const prices = (data.itemSummaries || [])
      .map(item => ({ price: parseFloat(item.price?.value || '0'), date: now }))
      .filter(p => p.price > 0);

    console.log('[proxy] Returning', prices.length, 'prices');
    return res.status(200).json(prices);

  } catch (e) {
    console.log('[proxy] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
