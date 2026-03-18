export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Ungültige Anfrage' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { url, pageContent } = body;

  const userMessage = pageContent && pageContent.length > 200
    ? `Analysiere diesen Funnel.\nURL: ${url}\n\nSeiteninhalt:\n${pageContent}`
    : `Analysiere diesen Funnel.\nURL: ${url}\n\nSeiteninhalt nicht verfügbar. Weise in jeder Section darauf hin.`;

  const SYSTEM_PROMPT = `Du bist Funnel-Analyst für DACH-Coaches, Berater und Agenturen. Antworte NUR mit validem JSON ohne Backticks oder Text davor/danach. Max 2 Sätze pro Feld. Analysiere ausschließlich was im Seiteninhalt steht, niemals erfinden.

Struktur:
{"gesamtScore":65,"gesamtBewertung":"2 Sätze.","topProblem":"1 Satz.","quickWin":"1 Satz.","sections":[{"id":"erstereindruck","title":"Erster Eindruck","subtitle":"Above the Fold","icon":"👁","score":6,"befund":"Was auf der Seite steht.","problem":"Konkretes Problem.","empfehlung":"Konkrete Empfehlung."}]}

12 sections exakt in dieser Reihenfolge:
{"id":"erstereindruck","title":"Erster Eindruck","subtitle":"Above the Fold","icon":"👁"}
{"id":"headline","title":"Headline & Hook","subtitle":"Aufmerksamkeit & Relevanz","icon":"🎯"}
{"id":"valueproposition","title":"Value Proposition","subtitle":"Nutzenversprechen","icon":"💎"}
{"id":"zielgruppe","title":"Zielgruppen-Fit","subtitle":"Ansprache & Relevanz","icon":"👥"}
{"id":"socialproof","title":"Social Proof","subtitle":"Vertrauen & Glaubwürdigkeit","icon":"⭐"}
{"id":"cta","title":"Call-to-Action","subtitle":"Aufforderung & Klarheit","icon":"🔴"}
{"id":"copy","title":"Copy & Sprache","subtitle":"Überzeugungskraft","icon":"✍️"}
{"id":"einwandbehandlung","title":"Einwandbehandlung","subtitle":"Bedenken & Widerstände","icon":"🛡"}
{"id":"conversionkiller","title":"Conversion-Killer","subtitle":"Ablenkungen & Fehler","icon":"⚠️"}
{"id":"mobile","title":"Mobile Experience","subtitle":"Smartphone-Optimierung","icon":"📱"}
{"id":"technik","title":"Technische Punkte","subtitle":"Ladezeit & Performance","icon":"⚙️"}
{"id":"fazit","title":"Prioritäten & Fazit","subtitle":"Dein Aktionsplan","icon":"📋"}

Score: 1-4 kritisch, 5-7 ausbaufähig, 8-10 gut.`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await claudeRes.json();
    const raw = (data.content?.[0]?.text ?? '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Bitte nochmal versuchen' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Fehler' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
