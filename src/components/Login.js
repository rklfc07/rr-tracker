import { useState } from "react";

const CORRECT_PASSWORD = process.env.REACT_APP_WORKSPACE_PASSWORD || "rr2026";

export default function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        localStorage.setItem("rr_auth", "true");
        onLogin();
      } else {
        setError("Incorrect password. Please try again.");
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border2)",
        borderRadius: 20,
        padding: "36px 32px",
        width: "100%",
        maxWidth: 360,
        boxShadow: "0 24px 60px rgba(0,0,0,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "var(--text)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "var(--bg)", letterSpacing: "-0.5px",
            flexShrink: 0,
          }}>R²</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--text)" }}>Rakesh & Raj</div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Workspace</div>
          </div>
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text)", marginBottom: 6 }}>Welcome back</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28 }}>Enter the workspace password to continue.</div>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>

          {error && (
            <div style={{
              background: "var(--red-dim)", border: "1px solid rgba(192,57,43,0.2)",
              borderRadius: 8, padding: "10px 14px",
              fontSize: 13, color: "var(--red)", marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", marginTop: 4, padding: "11px", fontSize: 14 }}
          >
            {loading ? "Checking…" : "Enter Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
