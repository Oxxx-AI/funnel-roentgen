import { useState } from "react";

const ACCENT = "#E84C6A";

function ScoreRing({ score, size = 88 }) {
  const r = size / 2 - 9;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score, 100) / 100;
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : ACCENT;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${circ*pct} ${circ}`} strokeLinecap="round"/>
      <text x={size/2} y={size/2+7} textAnchor="middle" fill="white"
        fontSize="20" fontWeight="800" style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 8 ? "#22c55e" : score >= 5 ? "#f59e0b" : ACCENT;
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color, background: color + "1a", padding: "3px 10px", borderRadius: 20, border: `1px solid ${color}33`, whiteSpace: "nowrap" }}>
      {score}/10
    </div>
  );
}

function ProgressBar({ score }) {
  const color = score >= 8 ? "#22c55e" : score >= 5 ? "#f59e0b" : ACCENT;
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, margin: "0 0 14px", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${score * 10}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}

export default function FunnelRoentgen() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState("input");
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [open, setOpen] = useState(null);

  const steps = [
    "Funnel wird geladen...",
    "Seitenstruktur wird analysiert...",
    "Headline & Copy wird geprüft...",
    "Trust-Elemente werden gescannt...",
    "Conversion-Schwachstellen identifiziert...",
    "Report wird generiert...",
  ];

  async function runAnalysis() {
    if (!url.trim()) return;
    setPhase("scanning");
    setScanStep(0);
    const iv = setInterval(() => setScanStep(s => Math.min(s + 1, steps.length - 1)), 3000);

    try {
      // Schritt 1: Jina Reader im Browser aufrufen (kein Server-Timeout)
      let pageContent = "";
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${url.trim()}`, {
          headers: { "Accept": "text/plain", "X-Return-Format": "text" },
        });
        if (jinaRes.ok) {
          const text = await jinaRes.text();
          if (text && text.length > 200) {
            pageContent = text.slice(0, 10000);
          }
        }
      } catch {
        pageContent = "";
      }

      // Schritt 2: Text + URL an API schicken — API ruft nur Claude auf (~8s)
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), pageContent }),
      });

      clearInterval(iv);

      const text = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Server-Fehler. Bitte nochmal versuchen.");
      }

      if (parsed.error) throw new Error(parsed.error);
      if (!parsed.sections) throw new Error("Ungültige Antwort. Bitte nochmal versuchen.");

      setReport(parsed);
      setPhase("report");
    } catch (e) {
      clearInterval(iv);
      setErrorMsg(e.message || "Unbekannter Fehler");
      setPhase("error");
    }
  }

  const base = { fontFamily: "'Inter', system-ui, sans-serif" };

  if (phase === "input") return (
    <div style={{ ...base, minHeight: 480, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 560, background: "linear-gradient(150deg,#1A1A2E 0%,#151554 100%)", borderRadius: 18, padding: "2.5rem 2rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700, color: ACCENT, marginBottom: 14 }}>OCHSOCHAL.DE</div>
        <h1 style={{ margin: "0 0 10px", fontSize: "clamp(28px,5vw,46px)", fontWeight: 900, color: "#fff", lineHeight: 1.05, letterSpacing: -1 }}>
          FUNNEL<span style={{ color: ACCENT }}>RÖNTGEN</span>
        </h1>
        <p style={{ margin: "0 0 2rem", fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          URL eingeben. 60 Sekunden warten. 12 kritische Conversion-Faktoren analysiert, bewertet, konkrete Empfehlungen geliefert.
        </p>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runAnalysis()}
          placeholder="https://dein-funnel.de/landing-page"
          style={{ width: "100%", padding: "13px 15px", fontSize: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
        />
        <button onClick={runAnalysis} style={{ width: "100%", padding: "14px", background: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>
          Funnel jetzt röntgen →
        </button>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {["12 Analyse-Bereiche", "KI-gestützte Diagnose", "Konkrete Empfehlungen"].map(t => (
          <div key={t} style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: ACCENT }}>✓</span>{t}
          </div>
        ))}
      </div>
    </div>
  );

  if (phase === "scanning") return (
    <div style={{ ...base, minHeight: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
      <div style={{ background: "linear-gradient(150deg,#1A1A2E 0%,#151554 100%)", borderRadius: 18, padding: "2.5rem", width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ position: "relative", width: 70, height: 70, marginBottom: "1.5rem" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid transparent`, borderTopColor: ACCENT, animation: "spin 0.7s linear infinite" }} />
          <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: `2px solid transparent`, borderTopColor: ACCENT + "66", animation: "spin 1.2s linear infinite reverse" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔬</div>
        </div>
        <div style={{ fontSize: 11, letterSpacing: 3, color: ACCENT, marginBottom: 10, fontWeight: 700 }}>ANALYSE LÄUFT</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{steps[scanStep]}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: "1.5rem", wordBreak: "break-all" }}>
          {url.length > 55 ? url.substring(0, 55) + "..." : url}
        </div>
        <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: ACCENT, borderRadius: 2, width: `${((scanStep + 1) / steps.length) * 100}%`, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>Schritt {scanStep + 1} von {steps.length}</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (phase === "error") return (
    <div style={{ ...base, padding: "3rem 1.5rem", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ margin: "0 0 8px" }}>Analyse fehlgeschlagen</h2>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}>{errorMsg}</p>
      <button onClick={() => { setPhase("input"); setReport(null); }} style={{ padding: "12px 28px", background: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Nochmal versuchen</button>
    </div>
  );

  if (!report) return null;

  const overallColor = report.gesamtScore >= 70 ? "#22c55e" : report.gesamtScore >= 50 ? "#f59e0b" : ACCENT;

  return (
    <div style={{ ...base, maxWidth: 700, margin: "0 auto", padding: "1.5rem 1rem" }}>
      <div style={{ background: "linear-gradient(150deg,#1A1A2E 0%,#151554 100%)", borderRadius: 16, padding: "1.75rem 1.5rem 1.5rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: ACCENT, fontWeight: 700, marginBottom: 10 }}>OCHSOCHAL · FUNNEL RÖNTGEN</div>
            <div style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 8 }}>Audit Report</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", wordBreak: "break-all" }}>{url}</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <ScoreRing score={report.gesamtScore} size={88} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginTop: 4 }}>GESAMT-SCORE</div>
          </div>
        </div>
        <div style={{ marginTop: "1.25rem", padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: 10, borderLeft: `3px solid ${overallColor}`, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.65 }}>
          {report.gesamtBewertung}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Kritischstes Problem", value: report.topProblem, accent: ACCENT, icon: "🔴" },
          { label: "Schnellster Quick Win", value: report.quickWin, accent: "#22c55e", icon: "⚡" },
        ].map(c => (
          <div key={c.label} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem", border: `0.5px solid var(--color-border-tertiary)` }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6, display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{c.icon}</span>
              <span style={{ fontWeight: 700, color: c.accent, letterSpacing: 0.5 }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--color-text-primary)" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem", border: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.25rem" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--color-text-secondary)", marginBottom: 12 }}>SCHNELLÜBERSICHT</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {report.sections?.map(s => {
            const c = s.score >= 8 ? "#22c55e" : s.score >= 5 ? "#f59e0b" : ACCENT;
            return (
              <div key={s.id} onClick={() => setOpen(open === s.id ? null : s.id)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1 }}>{s.title}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{s.score}/10</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.5rem" }}>
        {report.sections?.map((s) => {
          const c = s.score >= 8 ? "#22c55e" : s.score >= 5 ? "#f59e0b" : ACCENT;
          const isOpen = open === s.id;
          return (
            <div key={s.id} style={{ borderRadius: 10, overflow: "hidden", border: `0.5px solid ${isOpen ? c + "55" : "var(--color-border-tertiary)"}`, background: "var(--color-background-primary)" }}>
              <div onClick={() => setOpen(isOpen ? null : s.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.875rem 1rem", cursor: "pointer", background: isOpen ? "var(--color-background-secondary)" : "transparent" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: c + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{s.subtitle}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <ScoreBadge score={s.score} />
                  <span style={{ fontSize: 16, color: "var(--color-text-tertiary)", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: "0 1rem 1rem" }}>
                  <ProgressBar score={s.score} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "BEFUND", value: s.befund, border: "rgba(255,255,255,0.2)" },
                      { label: "PROBLEM", value: s.problem, border: ACCENT },
                      { label: "EMPFEHLUNG", value: s.empfehlung, border: "#22c55e" },
                    ].filter(x => x.value).map(item => (
                      <div key={item.label} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "0.75rem 0.875rem", borderLeft: `3px solid ${item.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: item.border === "rgba(255,255,255,0.2)" ? "var(--color-text-secondary)" : item.border, marginBottom: 5 }}>{item.label}</div>
                        <div style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.65 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => { setPhase("input"); setReport(null); setOpen(null); }} style={{ flex: 1, minWidth: 130, padding: "13px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>← Neuer Funnel</button>
        <button onClick={() => window.print()} style={{ flex: 1, minWidth: 130, padding: "13px", background: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Report als PDF speichern</button>
      </div>

      <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: 11, color: "var(--color-text-tertiary)" }}>
        ochsochal.de · Funnel Röntgen · KI-gestützte Funnel-Analyse
      </div>
    </div>
  );
}
