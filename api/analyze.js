export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { url } = await req.json();

  const SYSTEM_PROMPT = `Du bist Funnel-Analyst für DACH-Coaches und Berater. Antworte NUR mit validem JSON, keine Backticks, kein Text davor oder danach. Maximal 1 Satz pro Textfeld.

{"gesamtScore":65,"gesamtBewertung":"2 Sätze max.","topProblem":"1 Satz.","quickWin":"1 Satz.","sections":[{"id":"erstereindruck","title":"Erster Eindruck","subtitle":"Above the Fold","icon":"👁","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."}]}

12 sections exakt in dieser Reihenfolge:
erstereindruck👁, headline🎯, valueproposition💎, zielgruppe👥, socialproof⭐, cta🔴, copy✍️, einwandbehandlung🛡, conversionkiller⚠️, mobile📱, technik⚙️, fazit📋

Titles: Erster Eindruck, Headline & Hook, Value Proposition, Zielgruppen-Fit, Social Proof, Call-to-Action, Copy & Sprache, Einwandbehandlung, Conversion-Killer, Mobile Experience, Technische Punkte, Prioritäten & Fazit
Subtitles: Above the Fold, Aufmerksamkeit & Relevanz, Nutzenversprechen, Ansprache & Relevanz, Vertrauen & Glaubwürdigkeit, Aufforderung & Klarheit, Überzeugungskraft, Bedenken & Widerstände, Ablenkungen & Fehler, Smartphone-Optimierung, Ladezeit & Performance, Dein Aktionsplan`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Analysiere: ${url}` }],
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
      return new Response(JSON.stringify({ error: 'JSON Parse Fehler' }), { status: 500 });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Fehler' }), { status: 500 });
  }
}
