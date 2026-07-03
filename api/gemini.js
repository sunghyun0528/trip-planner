// /api/gemini.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) { res.status(500).json({ error: 'GEMINI_API_KEY not set' }); return; }

  const { name, category, address, rating, review_count, city } = req.body || {};
  if (!name) { res.status(400).json({ error: 'name required' }); return; }

  const prompt = `당신은 한국인 여행자 전용 여행 정보 전문가입니다.
아래 장소의 꿀팁을 JSON 형식으로만 출력하세요. JSON 외 텍스트 절대 금지.

장소명: ${name}
카테고리: ${category || '관광지'}
주소: ${address || ''}
평점: ${rating || '-'} / 리뷰: ${review_count || '-'}
도시: ${city || ''}

아래 JSON 구조 그대로 출력 (항목당 40자 이내, 한국어):
{
  "timing": "최적 방문 시간과 피해야 할 시간",
  "cost": "입장료 또는 가격대, 예약 필요 여부",
  "highlight": "절대 놓치면 안 될 핵심 포인트",
  "regret": "한국인이 방문 후 가장 많이 후회하는 것",
  "tip": "현지인 팁 또는 잘 알려지지 않은 정보",
  "nearby": [
    {"type": "식당", "name": "상호명", "desc": "특징 10자 이내"},
    {"type": "식당", "name": "상호명", "desc": "특징 10자 이내"},
    {"type": "카페", "name": "상호명", "desc": "특징 10자 이내"}
  ]
}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }),
      }
    );

    const data = await r.json();
    if (!r.ok) {
      console.error('[Gemini]', r.status, JSON.stringify(data));
      res.status(500).json({ error: `Gemini ${r.status}: ${data?.error?.message || ''}` });
      return;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) { res.status(500).json({ error: '파싱 실패', raw: text }); return; }

    let parsed;
    try { parsed = JSON.parse(m[0]); }
    catch (e) { res.status(500).json({ error: 'JSON 파싱 실패' }); return; }

    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
