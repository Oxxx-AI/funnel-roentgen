// FUNNEL RÖNTGEN — api/analyze.js
// Edge Runtime: 30s wall-clock limit
// Timing: Jina läuft im Browser (kein Timeout hier), Claude braucht ~18s für 1800 tokens → passt

export const config = { runtime: "edge" };

export default async function handler(req) {
  // CORS Preflight
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

  // Body einlesen
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body (kein JSON)" }, 400);
  }

  const { pageContent, url } = body || {};

  if (!pageContent || pageContent.trim().length < 50) {
    return json(
      { error: "Kein Seiteninhalt empfangen — Jina hat nichts zurückgegeben" },
      400
    );
  }

  // Auf 6000 Zeichen kürzen (= ~1500 Tokens) damit der Prompt überschaubar bleibt
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

  try {
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
        messages: [{ role: "user", content: prompt }],
      }),
    });

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

    const data = await anthropicRes.json();
    const rawText = data?.content?.[0]?.text || "";

    if (!rawText) {
      return json({ error: "Leere Antwort von Claude erhalten" }, 500);
    }

    // JSON aus der Antwort extrahieren (robust gegen führenden/nachfolgenden Text)
    let report;
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Kein JSON-Objekt in der Antwort gefunden");
      report = JSON.parse(match[0]);
    } catch (parseErr) {
      return json(
        {
          error: "JSON-Parsing fehlgeschlagen",
          rawPreview: rawText.slice(0, 500),
        },
        500
      );
    }

    // Minimale Validierung
    if (!report.categories || !Array.isArray(report.categories)) {
      return json(
        {
          error: "Ungültige Report-Struktur: 'categories' fehlt",
          rawPreview: rawText.slice(0, 500),
        },
        500
      );
    }

    return json(report, 200);
  } catch (err) {
    return json({ error: err.message || "Unbekannter Server-Fehler" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
