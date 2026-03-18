export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { url } = await req.json();

  // Jina AI Reader rendert JavaScript-Seiten vollständig (Perspective, ClickFunnels, etc.)
  let pageContent = '';
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
      },
      signal: AbortSignal.timeout(20000),
    });
    const text = await jinaRes.text();
    if (text && text.length > 200) {
      pageContent = text.slice(0, 12000);
    }
  } catch {
    pageContent = '';
  }

  const userMessage = pageContent.length > 200
    ? `Analysiere diesen Funnel.\nURL: ${url}\n\nSeiteninhalt:\n${pageContent}`
    : `Analysiere diesen Funnel.\nURL: ${url}\n\nDer Seiteninhalt konnte nicht geladen werden. Weise in jeder Section darauf hin.`;

  const SYSTEM_PROMPT = `Du bist Funnel-Analyst für DACH-Coaches, Berater und Agenturen im Hochpreissegment.

REGEL 1: Antworte NUR mit validem JSON. Keine Backticks, kein Text davor oder danach.
REGEL 2: Analysiere ausschließlich was im Seiteninhalt steht. Niemals erfinden.
REGEL 3: Zitiere konkret was du siehst (Headline-Text, CTA-Text, Testimonials etc.).
REGEL 4: Maximal 2 kurze Sätze pro Textfeld.

JSON-Struktur:
{
  "gesamtScore": 65,
  "gesamtBewertung": "Max 2 Sätze.",
  "topProblem": "Max 1 Satz.",
  "quickWin": "Max 1 Satz.",
  "sections": [
    {
      "id": "erstereindruck",
      "title": "Erster Eindruck",
      "subtitle": "Above the Fold",
      "icon": "👁",
      "score": 6,
      "befund": "Was tatsächlich auf der Seite steht.",
      "problem": "Konkretes Problem.",
      "empfehlung": "Konkrete Empfehlung."
    }
  ]
}

Genau 12 sections in dieser Reihenfolge:
1. id "erstereindruck", title "Erster Eindruck", subtitle "Above the Fold", icon "👁"
2. id "headline", title "Headline & Hook", subtitle "Aufmerksamkeit & Relevanz", icon "🎯"
3. id "valueproposition", title "Value Proposition", subtitle "Nutzenversprechen", icon "💎"
4. id "zielgruppe", title "Zielgruppen-Fit", subtitle "Ansprache & Relevanz", icon "👥"
5. id "socialproof", title "Social Proof", subtitle "Vertrauen & Glaubwürdigkeit", icon "⭐"
6. id "cta", title "Call-to-Action", subtitle "Aufforderung & Klarheit", icon "🔴"
7. id "copy", title "Copy & Sprache", subtitle "Überzeugungskraft", icon "✍️"
8. id "einwandbehandlung", title "Einwandbehandlung", subtitle "Bedenken & Widerstände", icon "🛡"
9. id "conversionkiller", title "Conversion-Killer", subtitle "Ablenkungen & Fehler", icon "⚠️"
10. id "mobile", title "Mobile Experience", subtitle "Smartphone-Optimierung", icon "📱"
11. id "technik", title "Technische Punkte", subtitle "Ladezeit & Performance", icon "⚙️"
12. id "fazit", title "Prioritäten & Fazit", subtitle "Dein Aktionsplan", icon "📋"

Score: 1-4 kritisch, 5-7 ausbaufähig, 8-10 gut.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim() ?? '';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Bitte nochmal versuchen' }), { status: 500 });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Fehler' }), { status: 500 });
  }
}
