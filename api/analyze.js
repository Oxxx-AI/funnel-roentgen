export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  const SYSTEM_PROMPT = `Du bist ein Elite-Funnel-Analyst für DACH-Coaches, Berater und Agenturen.

WICHTIG: Antworte NUR mit validem JSON. Keine Backticks, kein Markdown, keine Erklärungen.

Halte jeden Textwert KURZ: max 2 Sätze pro Feld.

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
      "befund": "Max 2 Sätze.",
      "problem": "Max 1 Satz.",
      "empfehlung": "Max 2 Sätze."
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

Sei direkt und konkret. Score 1-4 kritisch, 5-7 ausbaufähig, 8-10 gut.`;

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
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Analysiere diesen Funnel: ${url}` }],
      }),
    });

    const data = await response.json();

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'Keine Antwort von Claude erhalten' });
    }

    const raw = data.content[0].text.trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return res.status(500).json({ error: 'JSON Parse Fehler' });
        }
      } else {
        return res.status(500).json({ error: 'Kein JSON in Antwort gefunden' });
      }
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
