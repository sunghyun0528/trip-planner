// /api/city-images.js
// city_images 테이블 CRUD — 서버 환경에서만 service_role 사용

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://izmlenodqnvisymjnlyg.supabase.co';
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_TOKEN  = process.env.SCRAPER_ADMIN_TOKEN;

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  // GET — 전체 목록 (인증 불필요, index.html 카드 표시용)
  if (req.method === 'GET') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/city_images?select=city_ko,city_en,image_url,image_credit,verified&order=city_ko`,
      { headers }
    );
    const data = await r.json();
    res.status(200).json(data);
    return;
  }

  // POST/DELETE — 관리자 토큰 필요
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  if (!SERVICE_KEY) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }); return;
  }

  // POST — 추가 또는 수정 (city_ko가 이미 있으면 덮어쓰기)
  if (req.method === 'POST') {
    const { city_ko, city_en, image_url, image_credit, verified } = req.body;
    if (!city_ko || !city_en || !image_url) {
      res.status(400).json({ error: 'city_ko, city_en, image_url 필수' }); return;
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/city_images`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        city_ko, city_en, image_url,
        image_credit: image_credit || null,
        verified: verified || false,
        updated_at: new Date().toISOString(),
      }),
    });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json({ error: JSON.stringify(data) }); return; }
    res.status(200).json({ success: true, data });
    return;
  }

  // DELETE — city_ko로 삭제
  if (req.method === 'DELETE') {
    const city_ko = req.query.city_ko || req.body?.city_ko;
    if (!city_ko) { res.status(400).json({ error: 'city_ko 필수' }); return; }
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/city_images?city_ko=eq.${encodeURIComponent(city_ko)}`,
      { method: 'DELETE', headers }
    );
    if (!r.ok) { const e = await r.text(); res.status(r.status).json({ error: e }); return; }
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
