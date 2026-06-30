// /api/import-places.js
// Vercel 서버리스 함수 — 브라우저에서 직접 service_role 키를 쓸 수 없으므로
// 이 서버 환경에서만 안전하게 키를 사용해 Supabase에 저장합니다.
// 환경변수 SUPABASE_SERVICE_ROLE_KEY는 Vercel 대시보드에서 설정 (VITE_ 접두사 절대 금지 — 접두사 붙이면 브라우저에 노출됨)

export default async function handler(req, res) {
  // CORS — scraper.html이 같은 도메인에서 호출하므로 기본적으로 불필요하지만 안전하게 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 간단한 관리자 토큰 체크 (스크래퍼 오남용 방지)
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.SCRAPER_ADMIN_TOKEN) {
    res.status(401).json({ error: 'Unauthorized — invalid admin token' });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://izmlenodqnvisymjnlyg.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_KEY) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured on server' });
    return;
  }

  try {
    if (req.method === 'GET') {
      // 중복 체크용 — ?google_place_id=xxx
      const placeId = req.query.google_place_id;
      if (!placeId) { res.status(400).json({ error: 'google_place_id required' }); return; }

      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/places_db?select=id&google_place_id=eq.${encodeURIComponent(placeId)}&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const data = await r.json();
      res.status(200).json({ exists: Array.isArray(data) && data.length > 0 });
      return;
    }

    if (req.method === 'POST') {
      // 장소 저장 (단건 또는 배열)
      const body = req.body;
      const rows = Array.isArray(body) ? body : [body];

      const r = await fetch(`${SUPABASE_URL}/rest/v1/places_db`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(rows),
      });

      if (!r.ok) {
        const errText = await r.text();
        res.status(r.status).json({ error: errText });
        return;
      }

      res.status(200).json({ success: true, count: rows.length });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
