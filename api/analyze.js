// FUNNEL RÖNTGEN — api/analyze.js
// Streaming-Lösung: Anthropic's SSE-Stream wird direkt an den Browser weitergeleitet.
// Kein Timeout-Problem mehr — Daten fließen kontinuierlich, Vercel wartet nicht auf das Ende.

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

  const prompt = `Du bist ein Conversion-Rate-Optimierungs-Experte. Analysiere diese Landing Page / Funnel anhand des unten stehenden Seiteninhalts.

URL: ${url}

SEITENINHALT:
${content}

WICHTIG: Basiere ALLES ausschließlich auf dem obigen Seiteninhalt. Wenn Social Proof vorhanden ist, erkenne ihn an. Wenn eine Headline vorhanden ist, zitiere sie. Halluziniere nichts.

Antworte ausschließlich mit folgendem JSON-Objekt — kein Text davor, kein Text danach, kein Markdown:
{
  "url": "${url}",
  "overallScore": <Zahl 0-100>,
  "summary": "<2 konkrete Sätze: Was macht die Seite gut und was ist die größte Schwäche>",
  "categories": [
    {
      "name": "<Kategoriename>",
      "score": <Zahl 0-100>,
      "status": "<good|warning|critical>",
      "finding": "<Was konkret vorhanden ist — 1 Satz, basierend auf dem Seiteninhalt>",
      "problem": "<Was fehlt oder schwach ist — 1 Satz>",
      "recommendation": "<Konkrete Maßnahme zur Verbesserung — 1 Satz>"
    }
  ]
}

Analysiere genau diese 12 Kategorien in dieser Reihenfolge:
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

Status-Regel: good = Score 70–100, warning = 40–69, critical = 0–39`;

  // Anthropic mit stream: true aufrufen
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

  // Bei Anthropic-Fehler: normale JSON-Fehlerantwort
  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return json(
      {
        error: `Anthropic API Fehler: ${anthropicRes.status}`,
        details: errText.slice(0, 400),
      },
      500
    );
  }

  // SSE-Stream direkt an den Browser weiterleiten — kein Puffern, kein Timeout
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
