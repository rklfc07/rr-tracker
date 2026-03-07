import { useState } from "react";
import { supabase } from "../lib/supabase";

const SERVICES = ["SEO", "Google Ads", "Social Media", "Website Development", "SaaS Product", "Content Writing"];
const SERVICE_COLORS = {
  "SEO":                  { color: "#2d7a4a", bg: "rgba(45,122,74,0.1)" },
  "Google Ads":           { color: "#2563a8", bg: "rgba(37,99,168,0.1)" },
  "Social Media":         { color: "#9333ea", bg: "rgba(147,51,234,0.1)" },
  "Website Development":  { color: "#c97d2a", bg: "rgba(201,125,42,0.1)" },
  "SaaS Product":         { color: "#0891b2", bg: "rgba(8,145,178,0.1)" },
  "Content Writing":      { color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
};
const STATUS_CFG = {
  "Todo":        { color: "#8a8a72", bg: "rgba(138,138,114,0.12)" },
  "In Progress": { color: "#c97d2a", bg: "rgba(201,125,42,0.12)" },
  "Done":        { color: "#2d7a4a", bg: "rgba(45,122,74,0.12)" },
  "Blocked":     { color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
};
const USERS = ["Rakesh", "Raj"];

const PRESET_COLORS = [
  { name: "Amber",  value: "#c97d2a" },
  { name: "Green",  value: "#2d7a4a" },
  { name: "Red",    value: "#c0392b" },
  { name: "Blue",   value: "#2563a8" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Orange", value: "#ea580c" },
];

const EMPTY_FORM = { name: "", category: "Client", client_name: "", color: "#c97d2a", budget: "", received: "", services: [] };

function fmt(n) {
  if (!n) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function Dashboard({ projects, onSelectProject, onRefresh }) {
  const [serviceFilter, setServiceFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [modalMode, setModalMode] = useState(null); // null | 'add' | 'edit'
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const allTasks = projects.flatMap(p => p.tasks || []);
  const stats = {
    projects: projects.length,
    inProgress: allTasks.filter(t => t.status === "In Progress").length,
    done: allTasks.filter(t => t.status === "Done").length,
    totalBudget: projects.reduce((s, p) => s + (Number(p.budget) || 0), 0),
  };

  const filtered = projects.filter(p => {
    if (serviceFilter !== "All" && !(p.services || []).includes(serviceFilter)) return false;
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditingProject(null); setModalMode("add"); };
  const openEdit = (e, p) => {
    e.stopPropagation();
    setForm({ name: p.name, category: p.category || "Client", client_name: p.client_name || "", color: p.color || "#c97d2a", budget: p.budget || "", received: p.received || "", services: p.services || [] });
    setEditingProject(p);
    setModalMode("edit");
  };

  const toggleService = (s) => setForm(f => ({ ...f, services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s] }));

  const saveProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { name: form.name, category: form.category, client_name: form.client_name, color: form.color, budget: Number(form.budget) || 0, received: Number(form.received) || 0, services: form.services };
    if (modalMode === "add") {
      await supabase.from("projects").insert([data]);
    } else {
      await supabase.from("projects").update(data).eq("id", editingProject.id);
    }
    setSaving(false); setModalMode(null); onRefresh();
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

  const serviceCounts = {};
  SERVICES.forEach(s => { serviceCounts[s] = projects.filter(p => (p.services || []).includes(s)).length; });

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
        <div className="stats-grid">
          {[
            { label: "Projects",    value: stats.projects,               color: "#1a1a14" },
            { label: "In Progress", value: stats.inProgress,             color: "#c97d2a" },
            { label: "Completed",   value: stats.done,                   color: "#2d7a4a" },
            { label: "Total Budget",value: fmt(stats.totalBudget),       color: "#2563a8" },
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

        <div className="toolbar">
          <input className="search-input" placeholder="Search projects…" value={searchText} onChange={e => setSearchText(e.target.value)} />
          <button className="btn-primary" onClick={openAdd}>+ New Project</button>
        </div>

        {/* Service filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
          <button className={`filter-btn ${serviceFilter === "All" ? "active" : ""}`} onClick={() => setServiceFilter("All")}>
            All <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.6 }}>{projects.length}</span>
          </button>
          {SERVICES.map(s => {
            const cfg = SERVICE_COLORS[s];
            const isActive = serviceFilter === s;
            return (
              <button key={s} onClick={() => setServiceFilter(s)} style={{
                padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${isActive ? cfg.color : "var(--border)"}`,
                background: isActive ? cfg.bg : "var(--surface)",
                color: isActive ? cfg.color : "var(--muted)",
                fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
              }}>
                {s}
                <span style={{ fontSize: 11, opacity: 0.65, background: "rgba(0,0,0,0.06)", padding: "1px 6px", borderRadius: 10 }}>{serviceCounts[s]}</span>
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
            const color = p.color || "#c97d2a";
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
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button className="btn-edit" onClick={e => openEdit(e, p)}>Edit</button>
                    <button className="btn-danger" style={{ padding: "4px 9px" }} onClick={e => deleteProject(e, p.id)}>✕</button>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                    {tags.map(tag => {
                      const cfg = SERVICE_COLORS[tag] || { color: "#c97d2a", bg: "rgba(201,125,42,0.1)" };
                      return <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: cfg.bg, color: cfg.color, letterSpacing: "0.03em" }}>{tag}</span>;
                    })}
                  </div>
                )}

                <div className="progress-row">
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{done}/{tasks.length} tasks</span>
                  <span style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>

                <div className="project-meta">
                  {Object.entries(STATUS_CFG).map(([s, cfg]) => {
                    const cnt = tasks.filter(t => t.status === s).length;
                    if (!cnt) return null;
                    return <span key={s} className="badge" style={{ color: cfg.color, background: cfg.bg }}>{s}: {cnt}</span>;
                  })}
                </div>

                <div className="finance-row">
                  <div className="finance-item"><div className="finance-label">Budget</div><div className="finance-value" style={{ color: "var(--blue)" }}>{fmt(p.budget)}</div></div>
                  <div className="finance-item"><div className="finance-label">Received</div><div className="finance-value" style={{ color: "var(--green)" }}>{fmt(p.received)}</div></div>
                  <div className="finance-item"><div className="finance-label">Balance</div><div className="finance-value" style={{ color: balance >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(balance)}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modalMode && (
        <div className="modal-backdrop" onClick={() => setModalMode(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modalMode === "add" ? "New Project" : "Edit Project"}</div>

            <div className="field"><label>Project Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Google Ads – Computhink" />
            </div>
            <div className="field-row">
              <div className="field"><label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {["Marketing", "Client", "Website", "SaaS Product"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Client Name (optional)</label>
                <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. Computhink" />
              </div>
            </div>

            {/* Color swatches */}
            <div className="field">
              <label>Project Color</label>
              <div className="color-swatches">
                {PRESET_COLORS.map(c => (
                  <div key={c.value} className={`color-swatch ${form.color === c.value ? "selected" : ""}`}
                    style={{ background: c.value }} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Service Tags */}
            <div className="field">
              <label>Services</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 2 }}>
                {SERVICES.map(s => {
                  const cfg = SERVICE_COLORS[s];
                  const active = form.services.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleService(s)} style={{
                      padding: "6px 13px", borderRadius: 7, cursor: "pointer",
                      border: `1px solid ${active ? cfg.color : "var(--border)"}`,
                      background: active ? cfg.bg : "var(--surface2)",
                      color: active ? cfg.color : "var(--muted)",
                      fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
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
              <button className="btn-primary" onClick={saveProject} disabled={saving}>{saving ? "Saving…" : modalMode === "add" ? "Create Project" : "Save Changes"}</button>
              <button className="btn-ghost" onClick={() => setModalMode(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
