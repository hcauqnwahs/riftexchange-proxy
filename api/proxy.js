export default async function handler(req, res) {
  if (req.method === 'POST') {
    return res.status(200).json({ status: 'ok' });
  }

  // Pass the raw query string directly — avoids URLSearchParams re-encoding
  // parentheses in itemFilter(0).name into %28%29 which eBay doesn't accept
  const rawQuery = req.url.includes('?') ? req.url.split('?').slice(1).join('?') : '';
  const ebayURL = `https://svcs.ebay.com/services/search/FindingService/v1?${rawQuery}`;

  console.log('[proxy] Calling eBay:', ebayURL);

  try {
    const response = await fetch(ebayURL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RiftExchange/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const body = await response.text();
    console.log('[proxy] eBay status:', response.status);
    console.log('[proxy] eBay headers:', JSON.stringify(Object.fromEntries(response.headers)));
    console.log('[proxy] eBay body:', body.substring(0, 500));

    res.status(response.status).setHeader('Content-Type', 'application/json').send(body);
  } catch (e) {
    console.log('[proxy] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
