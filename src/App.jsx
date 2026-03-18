// FUNNEL RÖNTGEN — src/App.jsx
// Architektur:
// 1. Jina läuft im Browser (kein Vercel-Timeout)
// 2. /api/analyze streamt die Anthropic-Antwort als SSE
// 3. Browser liest den Stream Token für Token, akkumuliert JSON, parst am Ende

import { useState } from "react";

const ICONS = {
  "Headline & Hook": "🎯",
  "Subheadline & Kontext": "📝",
  "Problem-Agitation": "⚡",
  "Nutzenversprechen (Value Proposition)": "💎",
  "Social Proof & Testimonials": "⭐",
  "Trust-Signale & Glaubwürdigkeit": "🛡️",
  "Call-to-Action (CTA)": "🔥",
  "Angebot & Preistransparenz": "💰",
  "Einwandbehandlung & FAQ": "❓",
  "Visuelles Design & Layout": "🎨",
  "Mobile-Optimierung": "📱",
  "Technische Performance": "⚙️",
};

const STATUS_COLOR = { good: "#22c55e", warning: "#f59e0b", critical: "#ef4444" };
const STATUS_LABEL = { good: "GUT", warning: "VERBESSERBAR", critical: "KRITISCH" };

// ── Score Ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ position: "relative", width: 136, height: 136, flexShrink: 0 }}>
      <svg width="136" height="136" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="68" cy="68" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="68" cy="68" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)", textAlign: "center",
      }}>
        <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 1, marginTop: 2 }}>SCORE</div>
      </div>
    </div>
  );
}

// ── Category Card ────────────────────────────────────────────────────────────
function CategoryCard({ cat }) {
  const [open, setOpen] = useState(false);
  const color = STATUS_COLOR[cat.status] || "#64748b";
  const icon = ICONS[cat.name] || "📊";

  return (
    <div style={{
      background: "#0f172a",
      border: `1px solid ${open ? "#EB3255" : "#1e293b"}`,
      borderRadius: 8,
      marginBottom: 8,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: "50%", background: "#1e293b",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cat.name}
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
            Score: <span style={{ color, fontWeight: 700 }}>{cat.score}/100</span>
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          color, background: `${color}20`,
          padding: "3px 8px", borderRadius: 4, flexShrink: 0,
        }}>
          {STATUS_LABEL[cat.status] || cat.status?.toUpperCase()}
        </div>
        <div style={{ color: "#475569", fontSize: 14, marginLeft: 4 }}>{open ? "▲" : "▼"}</div>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid #1e293b", padding: "16px" }}>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { label: "BEFUND", labelColor: "#64748b", text: cat.finding },
              { label: "PROBLEM", labelColor: "#ef4444", text: cat.problem },
              { label: "EMPFEHLUNG", labelColor: "#EB3255", text: cat.recommendation },
            ].map(({ label, labelColor, text }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: labelColor, letterSpacing: 1, marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 }}>{text}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${cat.score}%`, background: color, borderRadius: 2 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── SSE Stream lesen und JSON akkumulieren ───────────────────────────────────
async function readStreamingReport(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        // Anthropic SSE: content_block_delta enthält die Text-Tokens
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          accumulated += parsed.delta.text;
        }
      } catch {
        // Malformed SSE-Event ignorieren
      }
    }
  }

  return accumulated;
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState("idle"); // idle | fetching | analyzing | done | error
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  async function runAudit() {
    if (!url.trim()) return;
    const cleanUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;

    setStep("fetching");
    setError("");
    setReport(null);
    setStatusMsg("Seite wird geladen (Jina Reader rendert JavaScript)...");

    // ── Schritt 1: Jina im Browser ─────────────────────────────────────────
    let pageContent = "";
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
        headers: { Accept: "text/plain" },
      });
      if (!jinaRes.ok) throw new Error(`HTTP ${jinaRes.status}`);
      pageContent = await jinaRes.text();
      if (!pageContent || pageContent.trim().length < 50) {
        throw new Error("Seite ist leer oder wurde geblockt");
      }
    } catch (err) {
      setStep("error");
      setError(`Seite konnte nicht geladen werden: ${err.message}`);
      return;
    }

    // ── Schritt 2: Streaming-Analyse ───────────────────────────────────────
    setStep("analyzing");
    setStatusMsg("KI analysiert deinen Funnel... (Antwort wird gestreamt)");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl, pageContent }),
      });

      // Prüfen ob die Antwort ein SSE-Stream oder eine JSON-Fehlerantwort ist
      const contentType = res.headers.get("Content-Type") || "";

      if (!res.ok || !contentType.includes("text/event-stream")) {
        // Fehler-JSON lesen
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
        throw new Error(data.error || `Server-Fehler ${res.status}`);
      }

      // Stream lesen
      const rawText = await readStreamingReport(res);

      if (!rawText) throw new Error("Leere Antwort vom KI-Modell erhalten");

      // JSON aus dem akkumulierten Text extrahieren
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Kein JSON in der KI-Antwort gefunden");

      let data;
      try {
        data = JSON.parse(match[0]);
      } catch {
        throw new Error("JSON konnte nicht geparst werden");
      }

      if (!data.categories || !Array.isArray(data.categories)) {
        throw new Error("Report-Struktur ungültig");
      }

      setReport(data);
      setStep("done");
    } catch (err) {
      setStep("error");
      setError(`Analyse-Fehler: ${err.message}`);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#020817",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#f1f5f9",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #334155; }
        @media print { button { display: none !important; } .no-print { display: none !important; } }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #0f172a", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EB3255", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          🔬
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.5 }}>
            Funnel <span style={{ color: "#EB3255" }}>Röntgen</span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>by ochsocial</div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>

        {/* Hero + Input */}
        {(step === "idle" || step === "error") && (
          <>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{
                display: "inline-block", background: "#EB325520", color: "#EB3255",
                fontSize: 11, fontWeight: 700, letterSpacing: 2,
                padding: "6px 16px", borderRadius: 100, marginBottom: 20,
              }}>
                KI-POWERED AUDIT
              </div>
              <h1 style={{ fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16, letterSpacing: -1 }}>
                Dein Funnel unter dem{" "}
                <span style={{ color: "#EB3255" }}>Röntgengerät</span>
              </h1>
              <p style={{ color: "#64748b", fontSize: 16, lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
                URL eingeben. In ~60 Sekunden bekommst du einen vollständigen
                Audit mit 12 Kategorien und konkreten Handlungsempfehlungen.
              </p>
            </div>

            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <div style={{ display: "flex", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden", background: "#0f172a" }}>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runAudit()}
                  placeholder="https://dein-funnel.de/landing"
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    padding: "16px 20px", fontSize: 15, color: "#f1f5f9", fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={runAudit}
                  disabled={!url.trim()}
                  style={{
                    background: "#EB3255", color: "white", border: "none",
                    padding: "16px 28px", fontSize: 14, fontWeight: 700,
                    cursor: url.trim() ? "pointer" : "not-allowed",
                    opacity: url.trim() ? 1 : 0.5,
                    letterSpacing: 0.5, fontFamily: "inherit", whiteSpace: "nowrap",
                  }}
                >
                  Röntgen →
                </button>
              </div>

              {step === "error" && (
                <div style={{
                  marginTop: 16, background: "#1e0a0a", border: "1px solid #7f1d1d",
                  borderRadius: 8, padding: "12px 16px", color: "#fca5a5", fontSize: 13, lineHeight: 1.6,
                }}>
                  ⚠️ {error}
                </div>
              )}

              <p style={{ textAlign: "center", color: "#1e293b", fontSize: 12, marginTop: 14 }}>
                Kompatibel mit Perspective, ClickFunnels, WordPress, Kajabi & mehr
              </p>
            </div>
          </>
        )}

        {/* Loading */}
        {(step === "fetching" || step === "analyzing") && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{
              width: 56, height: 56, margin: "0 auto 24px",
              border: "3px solid #1e293b", borderTop: "3px solid #EB3255",
              borderRadius: "50%", animation: "spin 1s linear infinite",
            }} />
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>
              {step === "fetching" ? "Seite wird geladen..." : "KI analysiert deinen Funnel..."}
            </div>
            <div style={{ color: "#475569", fontSize: 14 }}>{statusMsg}</div>
          </div>
        )}

        {/* Report */}
        {step === "done" && report && (
          <div>
            {/* Score Header */}
            <div style={{
              background: "#0f172a", border: "1px solid #1e293b",
              borderRadius: 16, padding: "28px 32px", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
            }}>
              <ScoreRing score={report.overallScore} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 2, marginBottom: 8 }}>
                  GESAMT-AUDIT · {report.url}
                </div>
                <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7 }}>{report.summary}</div>
                <button
                  onClick={() => window.print()}
                  className="no-print"
                  style={{
                    marginTop: 16, background: "transparent", border: "1px solid #EB3255",
                    color: "#EB3255", padding: "8px 20px", borderRadius: 6,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    letterSpacing: 0.5, fontFamily: "inherit",
                  }}
                >
                  PDF EXPORTIEREN
                </button>
              </div>
            </div>

            {/* Score Distribution */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              {[
                { label: "Gut (70+)", count: report.categories.filter((c) => c.score >= 70).length, color: "#22c55e" },
                { label: "Verbesserbar", count: report.categories.filter((c) => c.score >= 40 && c.score < 70).length, color: "#f59e0b" },
                { label: "Kritisch", count: report.categories.filter((c) => c.score < 40).length, color: "#ef4444" },
              ].map((item) => (
                <div key={item.label} style={{
                  background: "#0f172a", border: `1px solid ${item.color}30`,
                  borderRadius: 10, padding: "16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: item.color }}>{item.count}</div>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, marginTop: 4 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Categories */}
            <div>
              {report.categories.map((cat, i) => <CategoryCard key={i} cat={cat} />)}
            </div>

            {/* New Audit */}
            <div className="no-print" style={{ textAlign: "center", marginTop: 32 }}>
              <button
                onClick={() => { setStep("idle"); setReport(null); setUrl(""); }}
                style={{
                  background: "#EB3255", color: "white", border: "none",
                  padding: "14px 36px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", letterSpacing: 0.5, fontFamily: "inherit",
                }}
              >
                Neue Analyse starten
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
