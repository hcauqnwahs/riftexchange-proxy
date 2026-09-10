export default async function handler(req, res) {
  if (req.method === 'POST') {
    return res.status(200).json({ status: 'ok' });
  }
  const params = new URLSearchParams(req.query).toString();
  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RiftExchange/1.0)',
        'Accept': 'application/json'
      }
    });
    const body = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/json').send(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
