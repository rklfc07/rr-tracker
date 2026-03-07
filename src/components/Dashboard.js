import { useState } from "react";
import { supabase } from "../lib/supabase";

const SERVICES = ["SEO", "Google Ads", "Social Media", "Website Development", "SaaS Product", "Content Writing"];
const SERVICE_COLORS = {
  "SEO":                  { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  "Google Ads":           { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  "Social Media":         { color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
  "Website Development":  { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  "SaaS Product":         { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  "Content Writing":      { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
};
const STATUS_CFG = {
  "Todo":        { color: "#5a5a72", bg: "rgba(90,90,114,0.15)" },
  "In Progress": { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  "Done":        { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  "Blocked":     { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};
const USERS = ["Rakesh", "Raj"];

function fmt(n) {
  if (!n) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function Dashboard({ projects, onSelectProject, onRefresh }) {
  const [serviceFilter, setServiceFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Client", client_name: "", color: "#6e5de6", budget: "", received: "", services: [] });
  const [saving, setSaving] = useState(false);

  const allTasks = projects.flatMap(p => p.tasks || []);
  const stats = {
    projects: projects.length,
    inProgress: allTasks.filter(t => t.status === "In Progress").length,
    done: allTasks.filter(t => t.status === "Done").length,
    totalBudget: projects.reduce((s, p) => s + (Number(p.budget) || 0), 0),
  };

  const filtered = projects.filter(p => {
    if (serviceFilter !== "All") {
      const tags = p.services || [];
      if (!tags.includes(serviceFilter)) return false;
    }
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const toggleFormService = (s) => {
    setForm(f => ({
      ...f,
      services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s]
    }));
  };

  const saveProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from("projects").insert([{
      name: form.name, category: form.category, client_name: form.client_name,
      color: form.color, budget: Number(form.budget) || 0, received: Number(form.received) || 0,
      services: form.services,
    }]);
    setSaving(false);
    setAddOpen(false);
    setForm({ name: "", category: "Client", client_name: "", color: "#6e5de6", budget: "", received: "", services: [] });
    onRefresh();
  };

  const deleteProject = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this project and all its data?")) return;
    await supabase.from("tasks").delete().eq("project_id", id);
    await supabase.from("notes").delete().eq("project_id", id);
    await supabase.from("payments").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    onRefresh();
  };

  // Count projects per service for the filter bar
  const serviceCounts = {};
  SERVICES.forEach(s => {
    serviceCounts[s] = projects.filter(p => (p.services || []).includes(s)).length;
  });

  return (
    <>
      <div className="header">
        <div className="header-brand">
          <div className="header-logo">R²</div>
          <div>
            <div className="header-title">Rakesh & Raj</div>
            <div className="header-sub">Workspace</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="user-tabs">
            {["All", ...USERS].map(u => (
              <button key={u} className={`user-tab ${userFilter === u ? "active" : ""}`} onClick={() => setUserFilter(u)}>{u}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: "Projects", value: stats.projects, color: "#6e5de6" },
            { label: "In Progress", value: stats.inProgress, color: "#eab308" },
            { label: "Completed", value: stats.done, color: "#22c55e" },
            { label: "Total Budget", value: fmt(stats.totalBudget), color: "#3b82f6" },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
              <div className="stat-bar" style={{ background: s.color }} />
            </div>
          ))}
        </div>

        {/* Search + New Project */}
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input className="search-input" placeholder="Search projects…" value={searchText} onChange={e => setSearchText(e.target.value)} />
          <button className="btn-primary" onClick={() => setAddOpen(true)}>+ New Project</button>
        </div>

        {/* Service filter bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className={`filter-btn ${serviceFilter === "All" ? "active" : ""}`}
            onClick={() => setServiceFilter("All")}
          >
            All
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>{projects.length}</span>
          </button>
          {SERVICES.map(s => {
            const cfg = SERVICE_COLORS[s];
            const count = serviceCounts[s];
            const isActive = serviceFilter === s;
            return (
              <button key={s} onClick={() => setServiceFilter(s)} style={{
                padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${isActive ? cfg.color : "var(--border)"}`,
                background: isActive ? cfg.bg : "transparent",
                color: isActive ? cfg.color : "var(--muted)",
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
              }}>
                {s}
                <span style={{ fontSize: 11, opacity: 0.7, background: isActive ? "rgba(0,0,0,0.2)" : "var(--surface2)", padding: "1px 6px", borderRadius: 10 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Project Grid */}
        <div className="projects-grid">
          {filtered.map(p => {
            const tasks = userFilter === "All" ? (p.tasks || []) : (p.tasks || []).filter(t => t.assignee === userFilter);
            const done = tasks.filter(t => t.status === "Done").length;
            const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            const color = p.color || "#6e5de6";
            const balance = (Number(p.received) || 0) - (Number(p.budget) || 0);
            const tags = p.services || [];

            return (
              <div className="project-card" key={p.id} onClick={() => onSelectProject(p.id)}>
                <div className="project-top-bar" style={{ background: color }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="project-cat" style={{ color }}>{p.category}</div>
                    <div className="project-name">{p.name}</div>
                    {p.client_name && <div className="project-client">{p.client_name}</div>}
                  </div>
                  <button className="btn-danger" style={{ padding: "3px 9px", fontSize: 11, flexShrink: 0 }} onClick={e => deleteProject(e, p.id)}>✕</button>
                </div>

                {/* Service tags */}
                {tags.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                    {tags.map(tag => {
                      const cfg = SERVICE_COLORS[tag] || { color: "#6e5de6", bg: "rgba(110,93,230,0.12)" };
                      return (
                        <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: cfg.bg, color: cfg.color, letterSpacing: "0.03em" }}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="progress-row">
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{done}/{tasks.length} tasks</span>
                  <span style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>

                <div className="project-meta" style={{ marginBottom: 0 }}>
                  {Object.entries(STATUS_CFG).map(([s, cfg]) => {
                    const cnt = tasks.filter(t => t.status === s).length;
                    if (!cnt) return null;
                    return <span key={s} className="badge" style={{ color: cfg.color, background: cfg.bg }}>{s}: {cnt}</span>;
                  })}
                </div>

                <div className="finance-row">
                  <div className="finance-item">
                    <div className="finance-label">Budget</div>
                    <div className="finance-value" style={{ color: "var(--blue)" }}>{fmt(p.budget)}</div>
                  </div>
                  <div className="finance-item">
                    <div className="finance-label">Received</div>
                    <div className="finance-value" style={{ color: "var(--green)" }}>{fmt(p.received)}</div>
                  </div>
                  <div className="finance-item">
                    <div className="finance-label">Balance</div>
                    <div className="finance-value" style={{ color: balance >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(balance)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NEW PROJECT MODAL */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Project</div>

            <div className="field"><label>Project Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Google Ads – Computhink" />
            </div>

            <div className="field-row">
              <div className="field"><label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {["Marketing", "Client", "Website", "SaaS Product"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Color</label>
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ padding: 4, height: 42 }} />
              </div>
            </div>

            <div className="field"><label>Client Name (optional)</label>
              <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. Computhink" />
            </div>

            {/* Service Tags */}
            <div className="field">
              <label>Services (select all that apply)</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 2 }}>
                {SERVICES.map(s => {
                  const cfg = SERVICE_COLORS[s];
                  const active = form.services.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleFormService(s)} style={{
                      padding: "6px 13px", borderRadius: 7, cursor: "pointer",
                      border: `1px solid ${active ? cfg.color : "var(--border)"}`,
                      background: active ? cfg.bg : "var(--surface2)",
                      color: active ? cfg.color : "var(--muted)",
                      fontSize: 12, fontWeight: 600,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: "all 0.15s",
                    }}>
                      {active ? "✓ " : ""}{s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field-row">
              <div className="field"><label>Project Budget (₹)</label>
                <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0" />
              </div>
              <div className="field"><label>Amount Received (₹)</label>
                <input type="number" value={form.received} onChange={e => setForm(f => ({ ...f, received: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={saveProject} disabled={saving}>{saving ? "Saving…" : "Create Project"}</button>
              <button className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
