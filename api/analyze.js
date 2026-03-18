// FUNNEL RÖNTGEN — api/analyze.js
// Edge Runtime, Streaming, gehärteter Prompt (keine direkten Zitate → kein JSON-Break)

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Nur POST erlaubt" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body" }, 400);
  }

  const { pageContent, url } = body || {};

  if (!pageContent || pageContent.trim().length < 50) {
    return json({ error: "Kein Seiteninhalt empfangen" }, 400);
  }

  const content = pageContent.slice(0, 6000);

  // WICHTIG: Prompt verbietet direkte Zitate → verhindert unescapte " in JSON-Strings
  const prompt = `Du bist ein Conversion-Rate-Optimierungs-Experte. Analysiere diese Landing Page.

URL: ${url}

SEITENINHALT:
${content}

REGELN (sehr wichtig):
- Basiere ALLES auf dem Seiteninhalt oben
- Schreibe alle Textwerte in eigenen Worten — zitiere NIEMALS direkt aus dem Seiteninhalt
- Verwende KEINE Anführungszeichen innerhalb von Textwerten
- Verwende KEINE Sonderzeichen wie Gedankenstriche oder Apostrophe in Textwerten
- Halte alle Textwerte kurz (max 15 Wörter pro Feld)

AUSGABE: Antworte NUR mit diesem JSON. Kein Text davor, kein Text danach, kein Markdown, keine Codeblocks.
Erster Buchstabe deiner Antwort muss { sein. Letzter Buchstabe muss } sein.

{
  "url": "${url}",
  "overallScore": <Zahl 0-100>,
  "summary": "<max 20 Wörter, eigene Formulierung, keine Anführungszeichen>",
  "categories": [
    {
      "name": "<Kategoriename>",
      "score": <Zahl 0-100>,
      "status": "<good|warning|critical>",
      "finding": "<Was vorhanden ist, eigene Worte, max 12 Wörter>",
      "problem": "<Was fehlt, eigene Worte, max 12 Wörter>",
      "recommendation": "<Verbesserungsmaßnahme, eigene Worte, max 12 Wörter>"
    }
  ]
}

Analysiere exakt diese 12 Kategorien:
1. Headline & Hook
2. Subheadline & Kontext
3. Problem-Agitation
4. Nutzenversprechen (Value Proposition)
5. Social Proof & Testimonials
6. Trust-Signale & Glaubwürdigkeit
7. Call-to-Action (CTA)
8. Angebot & Preistransparenz
9. Einwandbehandlung & FAQ
10. Visuelles Design & Layout
11. Mobile-Optimierung
12. Technische Performance

Status-Regel: good = 70-100, warning = 40-69, critical = 0-39`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return json(
      { error: `Anthropic API Fehler: ${anthropicRes.status}`, details: errText.slice(0, 300) },
      500
    );
  }

  // SSE-Stream direkt zum Browser weiterleiten
  return new Response(anthropicRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
