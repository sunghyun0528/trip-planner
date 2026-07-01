// /api/unsplash.js
// Unsplash API 프록시 — 브라우저에 키 노출 없이 이미지 검색
// Vercel 환경변수: UNSPLASH_ACCESS_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const KEY = process.env.UNSPLASH_ACCESS_KEY;
  if (!KEY) { res.status(500).json({ error: 'UNSPLASH_ACCESS_KEY not configured' }); return; }

  const { query, count = 16 } = req.query;
  if (!query) { res.status(400).json({ error: 'query required' }); return; }

  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${count}&order_by=relevant`,
      { headers: { Authorization: `Client-ID ${KEY}` } }
    );

    if (!r.ok) {
      const err = await r.text();
      res.status(r.status).json({ error: err }); return;
    }

    const data = await r.json();

    // 필요한 필드만 추려서 반환 (raw URL이 핵심 — 파라미터 자유롭게 추가 가능)
    const hits = (data.results || []).map(p => ({
      id: p.id,
      raw: p.urls.raw,                       // 원본 base URL — 크롭 파라미터 붙임용
      thumb: p.urls.small,                   // 썸네일 (빠른 미리보기)
      description: p.description || p.alt_description || '',
      credit: `Photo by ${p.user.name} on Unsplash`,
      width: p.width,
      height: p.height,
      color: p.color,
    }));

    // 응답 캐시 1시간 (Unsplash 정책 준수 — 24시간 캐싱 권장)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json({ hits, total: data.total });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
