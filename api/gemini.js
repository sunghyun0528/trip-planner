// /api/gemini.js — Gemini 꿀팁 생성 서버리스 함수
// Vercel 환경변수: GEMINI_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) { res.status(500).json({ error: 'GEMINI_API_KEY not configured' }); return; }

  const { name, category, address, rating, review_count, city } = req.body;
  if (!name) { res.status(400).json({ error: 'name required' }); return; }

  const prompt = `당신은 한국인 여행자를 위한 여행 정보 전문가입니다.
아래 장소에 대한 꿀팁을 정확히 아래 JSON 형식으로만 출력하세요.
절대로 JSON 외의 텍스트, 인삿말, 설명을 출력하지 마세요.

[장소 정보]
장소명: ${name}
카테고리: ${category || '관광지'}
주소: ${address || city || ''}
평점: ${rating || '정보 없음'} (${review_count ? review_count.toLocaleString() + '개 리뷰' : ''})
도시: ${city || ''}

[출력 JSON 형식 — 항목당 40자 이내, 한국어, 이모지 금지]
{
  "timing": "방문 최적 시간대. 피크타임 언급. 1줄.",
  "cost": "입장료 또는 가격대. 무료면 무료 명시. 예약 필요 여부. 1줄.",
  "highlight": "이 장소에서 절대 놓치면 안 될 핵심 포인트. 1~2줄.",
  "regret": "한국인 방문객이 가장 많이 후회하는 것. 사전에 알았으면 좋았을 것. 1줄.",
  "tip": "현지인처럼 이용하는 법 또는 잘 알려지지 않은 실용 정보. 1줄.",
  "nearby": [
    { "type": "식당", "name": "장소명", "desc": "특징 10자 이내" },
    { "type": "식당", "name": "장소명", "desc": "특징 10자 이내" },
    { "type": "카페", "name": "장소명", "desc": "특징 10자 이내" }
  ]
}

nearby 작성 규칙:
- 한국인 여행자 사이에서 실제로 유명한 곳만
- 장소명 근처(도보 10~15분 이내) 기준
- 식당 2개, 카페 1개
- 확실하지 않으면 desc에 "현지 확인 필요" 표기
- JSON 외 텍스트 절대 금지`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,      // 낮게 — 창의성보다 정확성
            maxOutputTokens: 512,  // 간결하게
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!r.ok) {
      const err = await r.text();
      console.error('[Gemini API 오류]', r.status, err);
      res.status(r.status).json({ error: `Gemini API 오류: ${r.status}` }); return;
    }

    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { res.status(500).json({ error: '응답 파싱 실패', raw: text }); return; }

    res.setHeader('Cache-Control', 's-maxage=86400'); // 같은 장소 24시간 캐시
    res.status(200).json(parsed);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
