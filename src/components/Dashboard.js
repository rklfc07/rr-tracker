import { useState } from "react";
import { supabase } from "../lib/supabase";

const CATEGORIES = ["All", "Marketing", "Client", "Website", "SaaS Product"];
const STATUS_CFG = {
  "Todo": { color: "#5a5a72", bg: "rgba(90,90,114,0.15)" },
  "In Progress": { color: "#f5c842", bg: "rgba(245,200,66,0.12)" },
  "Done": { color: "#3fcf8e", bg: "rgba(63,207,142,0.12)" },
  "Blocked": { color: "#f7726a", bg: "rgba(247,114,106,0.12)" },
};
const CAT_COLORS = {
  "Marketing": "#f5c842", "Client": "#5eb8f7",
  "Website": "#3fcf8e", "SaaS Product": "#7c6af7"
};
const USERS = ["Rakesh", "Raj"];

function fmt(n) {
  if (!n) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function Dashboard({ projects, onSelectProject, onRefresh }) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Client", client_name: "", color: "#7c6af7", budget: "", received: "" });
  const [saving, setSaving] = useState(false);

  const allTasks = projects.flatMap(p => p.tasks || []);
  const stats = {
    projects: projects.length,
    inProgress: allTasks.filter(t => t.status === "In Progress").length,
    done: allTasks.filter(t => t.status === "Done").length,
    totalBudget: projects.reduce((s, p) => s + (Number(p.budget) || 0), 0),
  };

  const filtered = projects.filter(p => {
    if (category !== "All" && p.category !== category) return false;
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const saveProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from("projects").insert([{
      name: form.name, category: form.category, client_name: form.client_name,
      color: form.color, budget: Number(form.budget) || 0, received: Number(form.received) || 0,
    }]);
    setSaving(false);
    setAddOpen(false);
    setForm({ name: "", category: "Client", client_name: "", color: "#7c6af7", budget: "", received: "" });
    onRefresh();
  };

  const deleteProject = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this project and all its tasks?")) return;
    await supabase.from("tasks").delete().eq("project_id", id);
    await supabase.from("notes").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    onRefresh();
  };

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
              <button key={u} className={`user-tab ${search === u ? "active" : ""}`} onClick={() => setSearch(u)}>{u}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: "Projects", value: stats.projects, color: "#7c6af7" },
            { label: "In Progress", value: stats.inProgress, color: "#f5c842" },
            { label: "Completed", value: stats.done, color: "#3fcf8e" },
            { label: "Total Budget", value: fmt(stats.totalBudget), color: "#5eb8f7" },
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

        {/* Toolbar */}
        <div className="toolbar">
          <input className="search-input" placeholder="Search projects…" value={searchText} onChange={e => setSearchText(e.target.value)} />
          {CATEGORIES.map(c => (
            <button key={c} className={`filter-btn ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
          <button className="btn-primary" onClick={() => setAddOpen(true)}>+ New Project</button>
        </div>

        {/* Grid */}
        <div className="projects-grid">
          {filtered.map(p => {
            const tasks = search === "All" ? (p.tasks || []) : (p.tasks || []).filter(t => t.assignee === search);
            const done = tasks.filter(t => t.status === "Done").length;
            const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            const color = p.color || CAT_COLORS[p.category] || "#7c6af7";
            const profit = (Number(p.received) || 0) - (Number(p.budget) || 0);

            return (
              <div className="project-card" key={p.id} onClick={() => onSelectProject(p.id)}>
                <div className="project-top-bar" style={{ background: color }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div className="project-cat" style={{ color }}>{p.category}</div>
                    <div className="project-name">{p.name}</div>
                    {p.client_name && <div className="project-client">{p.client_name}</div>}
                  </div>
                  <button className="btn-danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={e => deleteProject(e, p.id)}>✕</button>
                </div>

                <div className="progress-row">
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{done}/{tasks.length} tasks</span>
                  <span style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>

                <div className="project-meta">
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
                    <div className="finance-value" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(profit)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Project</div>
            <div className="field"><label>Project Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Google Ads – Client X" /></div>
            <div className="field-row">
              <div className="field"><label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {["Marketing", "Client", "Website", "SaaS Product"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Color</label><input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ padding: 4, height: 42 }} /></div>
            </div>
            <div className="field"><label>Client Name (optional)</label><input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. Acme Corp" /></div>
            <div className="field-row">
              <div className="field"><label>Project Budget (₹)</label><input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0" /></div>
              <div className="field"><label>Amount Received (₹)</label><input type="number" value={form.received} onChange={e => setForm(f => ({ ...f, received: e.target.value }))} placeholder="0" /></div>
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
