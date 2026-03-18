export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { url } = await req.json();

  let pageContent = '';
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text', 'X-Timeout': '8' },
      signal: AbortSignal.timeout(10000),
    });
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (text && text.length > 200) {
        // Anführungszeichen und Sonderzeichen entfernen die JSON brechen
        const clean = text
          .replace(/"/g, "'")
          .replace(/\\/g, '')
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000);
        pageContent = clean;
      }
    }
  } catch {
    pageContent = '';
  }

  const userMessage = pageContent.length > 200
    ? `Analysiere diesen Funnel.\nURL: ${url}\n\nSeiteninhalt:\n${pageContent}`
    : `Analysiere diesen Funnel.\nURL: ${url}\n\nSeiteninhalt nicht verfügbar. Weise in jeder Section darauf hin.`;

  const SYSTEM_PROMPT = `Du bist Funnel-Analyst für DACH-Coaches, Berater und Agenturen.

KRITISCH: Antworte NUR mit validem JSON. Niemals Backticks, niemals Text davor oder danach.
KRITISCH: Verwende in allen Textwerten NIEMALS doppelte Anführungszeichen. Nutze stattdessen Apostrophe oder umschreibe.
KRITISCH: Max 1 Satz pro Feld. Kurz und konkret.
KRITISCH: Nur analysieren was im Seiteninhalt steht. Nichts erfinden.

Exakte JSON-Struktur:
{"gesamtScore":65,"gesamtBewertung":"2 kurze Saetze.","topProblem":"1 Satz.","quickWin":"1 Satz.","sections":[{"id":"erstereindruck","title":"Erster Eindruck","subtitle":"Above the Fold","icon":"👁","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"headline","title":"Headline & Hook","subtitle":"Aufmerksamkeit & Relevanz","icon":"🎯","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"valueproposition","title":"Value Proposition","subtitle":"Nutzenversprechen","icon":"💎","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"zielgruppe","title":"Zielgruppen-Fit","subtitle":"Ansprache & Relevanz","icon":"👥","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"socialproof","title":"Social Proof","subtitle":"Vertrauen & Glaubwuerdigkeit","icon":"⭐","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"cta","title":"Call-to-Action","subtitle":"Aufforderung & Klarheit","icon":"🔴","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"copy","title":"Copy & Sprache","subtitle":"Ueberzeugungskraft","icon":"✍️","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"einwandbehandlung","title":"Einwandbehandlung","subtitle":"Bedenken & Widerstaende","icon":"🛡","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"conversionkiller","title":"Conversion-Killer","subtitle":"Ablenkungen & Fehler","icon":"⚠️","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"mobile","title":"Mobile Experience","subtitle":"Smartphone-Optimierung","icon":"📱","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"technik","title":"Technische Punkte","subtitle":"Ladezeit & Performance","icon":"⚙️","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."},{"id":"fazit","title":"Prioritaeten & Fazit","subtitle":"Dein Aktionsplan","icon":"📋","score":6,"befund":"1 Satz.","problem":"1 Satz.","empfehlung":"1 Satz."}]}

Ersetze alle Platzhalterwerte mit echten Analysen. Score 1-4 kritisch, 5-7 ausbaufaehig, 8-10 gut.`;

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

    // Aggressiver JSON-Extraktor
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Ersten { bis letzten } extrahieren
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          parsed = JSON.parse(raw.slice(start, end + 1));
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Bitte nochmal versuchen' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Fehler' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
