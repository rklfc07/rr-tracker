import { useState } from "react";
import { supabase } from "../lib/supabase";

const SERVICES = ["SEO", "Google Ads", "Social Media", "Website Development", "SaaS Product", "Content Writing"];
const SERVICE_COLORS = {
  "SEO":                 { color: "#2d7a4a", bg: "rgba(45,122,74,0.1)" },
  "Google Ads":          { color: "#2563a8", bg: "rgba(37,99,168,0.1)" },
  "Social Media":        { color: "#9333ea", bg: "rgba(147,51,234,0.1)" },
  "Website Development": { color: "#c97d2a", bg: "rgba(201,125,42,0.1)" },
  "SaaS Product":        { color: "#0891b2", bg: "rgba(8,145,178,0.1)" },
  "Content Writing":     { color: "#c0392b", bg: "rgba(192,57,43,0.1)" },
};
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
  if (!n && n !== 0) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

function projectStatus(p) {
  const tasks = p.tasks || [];
  if (tasks.length === 0) return "No Tasks";
  const done = tasks.filter(t => t.status === "Done").length;
  const inProgress = tasks.filter(t => t.status === "In Progress").length;
  const blocked = tasks.filter(t => t.status === "Blocked").length;
  if (blocked > 0) return "Blocked";
  if (done === tasks.length) return "Done";
  if (inProgress > 0) return "In Progress";
  return "Todo";
}

const PROJ_STATUS_CFG = {
  "Todo":        { color: "#8a8a72", bg: "rgba(138,138,114,0.12)", dot: "#8a8a72" },
  "In Progress": { color: "#c97d2a", bg: "rgba(201,125,42,0.12)",  dot: "#c97d2a" },
  "Done":        { color: "#2d7a4a", bg: "rgba(45,122,74,0.12)",   dot: "#2d7a4a" },
  "Blocked":     { color: "#c0392b", bg: "rgba(192,57,43,0.1)",    dot: "#c0392b" },
  "No Tasks":    { color: "#8a8a72", bg: "rgba(138,138,114,0.08)", dot: "#ccc" },
};

export default function Dashboard({ projects, onSelectProject, onRefresh }) {
  const [serviceFilter, setServiceFilter] = useState("All");
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [userFilter,    setUserFilter]    = useState("All");
  const [searchText,    setSearchText]    = useState("");
  const [modalMode,     setModalMode]     = useState(null);
  const [editingProject,setEditingProject]= useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [saving,        setSaving]        = useState(false);
  const [sortBy,        setSortBy]        = useState("name"); // name | pending | progress | status
  const [sortDir,       setSortDir]       = useState("asc");

  const totalPending = projects.reduce((s, p) => {
    const payments = p.payments || [];
    const due = payments.reduce((a, pay) => a + (Number(pay.amount_due) || 0), 0);
    const rec = payments.reduce((a, pay) => a + (Number(pay.amount_received) || 0), 0);
    return s + Math.max(0, due - rec);
  }, 0);

  const stats = [
    { label: "Projects",    value: projects.length,                                    color: "#1a1a14" },
    { label: "In Progress", value: projects.filter(p => projectStatus(p) === "In Progress").length, color: "#c97d2a" },
    { label: "Completed",   value: projects.filter(p => projectStatus(p) === "Done").length,        color: "#2d7a4a" },
    { label: "Pending",     value: fmt(totalPending),                                  color: "#c0392b" },
  ];

  const STATUS_TABS = ["All", "Todo", "In Progress", "Done", "Blocked"];

  const filtered = projects.filter(p => {
    if (serviceFilter !== "All" && !(p.services || []).includes(serviceFilter)) return false;
    if (statusFilter  !== "All" && projectStatus(p) !== statusFilter) return false;
    if (userFilter    !== "All" && !(p.tasks || []).some(t => t.assignee === userFilter)) return false;
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase()) && !(p.client_name || "").toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va, vb;
    if (sortBy === "name")     { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    if (sortBy === "status")   { va = projectStatus(a); vb = projectStatus(b); }
    if (sortBy === "progress") {
      const pct = p => { const t = (p.tasks||[]); return t.length ? t.filter(x=>x.status==="Done").length/t.length : 0; };
      va = pct(a); vb = pct(b);
    }
    if (sortBy === "pending") {
      const pend = p => { const pays = p.payments||[]; return pays.reduce((s,x)=>s+(Number(x.amount_due)||0),0) - pays.reduce((s,x)=>s+(Number(x.amount_received)||0),0); };
      va = pend(a); vb = pend(b);
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };
  const sortIcon = (col) => sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const openAdd  = () => { setForm(EMPTY_FORM); setEditingProject(null); setModalMode("add"); };
  const openEdit = (e, p) => {
    e.stopPropagation();
    setForm({ name: p.name, category: p.category||"Client", client_name: p.client_name||"", color: p.color||"#c97d2a", budget: p.budget||"", received: p.received||"", services: p.services||[] });
    setEditingProject(p); setModalMode("edit");
  };
  const toggleService = (s) => setForm(f => ({ ...f, services: f.services.includes(s) ? f.services.filter(x=>x!==s) : [...f.services, s] }));

  const saveProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { name: form.name, category: form.category, client_name: form.client_name, color: form.color, budget: Number(form.budget)||0, received: Number(form.received)||0, services: form.services };
    if (modalMode === "add") await supabase.from("projects").insert([data]);
    else await supabase.from("projects").update(data).eq("id", editingProject.id);
    setSaving(false); setModalMode(null); onRefresh();
  };

  const deleteProject = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this project and all its data?")) return;
    for (const tbl of ["tasks","notes","payments"]) await supabase.from(tbl).delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    onRefresh();
  };

  const serviceCounts = {};
  SERVICES.forEach(s => { serviceCounts[s] = projects.filter(p => (p.services||[]).includes(s)).length; });
  const statusCounts = {};
  STATUS_TABS.forEach(s => { statusCounts[s] = s === "All" ? projects.length : projects.filter(p => projectStatus(p) === s).length; });

  const thStyle = (col) => ({
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: sortBy === col ? "var(--accent)" : "var(--muted)",
    textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
    whiteSpace: "nowrap", userSelect: "none", background: "var(--surface2)",
    borderBottom: "1px solid var(--border)",
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
            {["All", ...["Rakesh","Raj"]].map(u => (
              <button key={u} className={`user-tab ${userFilter===u?"active":""}`} onClick={() => setUserFilter(u)}>{u}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stats-grid">
          {stats.map(s => (
            <div className="stat-card" key={s.label}>
              <div><div className="stat-label">{s.label}</div><div className="stat-value" style={{ color: s.color }}>{s.value}</div></div>
              <div className="stat-bar" style={{ background: s.color }} />
            </div>
          ))}
        </div>

        {/* Search + New */}
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input className="search-input" placeholder="Search by project or client name…" value={searchText} onChange={e => setSearchText(e.target.value)} />
          <button className="btn-primary" onClick={openAdd}>+ New Project</button>
        </div>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
          {STATUS_TABS.map(s => {
            const cfg = PROJ_STATUS_CFG[s] || { color: "var(--muted)", dot: "#ccc" };
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: "9px 16px", border: "none", background: "none", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700,
                color: active ? (s === "All" ? "var(--text)" : cfg.color) : "var(--muted)",
                borderBottom: active ? `2px solid ${s === "All" ? "var(--text)" : cfg.color}` : "2px solid transparent",
                marginBottom: -1, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
              }}>
                {s !== "All" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? cfg.dot : "var(--muted)", display: "inline-block" }} />}
                {s}
                <span style={{ fontSize: 11, background: "var(--surface2)", padding: "1px 6px", borderRadius: 8, color: active ? cfg.color : "var(--muted)", fontWeight: 600 }}>{statusCounts[s]}</span>
              </button>
            );
          })}
        </div>

        {/* Service filter pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <button className={`filter-btn ${serviceFilter==="All"?"active":""}`} onClick={() => setServiceFilter("All")}>
            All Services
          </button>
          {SERVICES.map(s => {
            const cfg = SERVICE_COLORS[s];
            const active = serviceFilter === s;
            return (
              <button key={s} onClick={() => setServiceFilter(s)} style={{
                padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${active ? cfg.color : "var(--border)"}`,
                background: active ? cfg.bg : "var(--surface)",
                color: active ? cfg.color : "var(--muted)",
                fontSize: 11, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5,
              }}>
                {s} <span style={{ opacity: 0.6, fontSize: 10 }}>{serviceCounts[s]}</span>
              </button>
            );
          })}
        </div>

        {/* TABLE */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle("name")} onClick={() => toggleSort("name")}>Project{sortIcon("name")}</th>
                <th style={{ ...thStyle(""), cursor: "default" }}>Services</th>
                <th style={thStyle("status")} onClick={() => toggleSort("status")}>Status{sortIcon("status")}</th>
                <th style={thStyle("progress")} onClick={() => toggleSort("progress")}>Progress{sortIcon("progress")}</th>
                <th style={thStyle("pending")} onClick={() => toggleSort("pending")}>Billed{sortIcon("")}</th>
                <th style={thStyle("pending")} onClick={() => toggleSort("pending")}>Received{sortIcon("")}</th>
                <th style={thStyle("pending")} onClick={() => toggleSort("pending")}>Pending{sortIcon("pending")}</th>
                <th style={{ ...thStyle(""), cursor: "default", width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No projects found</td></tr>
              )}
              {sorted.map((p, i) => {
                const tasks   = (p.tasks || []);
                const done    = tasks.filter(t => t.status === "Done").length;
                const pct     = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
                const pays    = p.payments || [];
                const billed  = pays.reduce((s, x) => s + (Number(x.amount_due) || 0), 0);
                const recvd   = pays.reduce((s, x) => s + (Number(x.amount_received) || 0), 0);
                const pending = billed - recvd;
                const st      = projectStatus(p);
                const cfg     = PROJ_STATUS_CFG[st];
                const color   = p.color || "#c97d2a";
                const tags    = p.services || [];

                return (
                  <tr key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      cursor: "pointer", transition: "background 0.12s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Project name */}
                    <td style={{ padding: "14px 14px", minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 3, height: 32, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.2px" }}>{p.name}</div>
                          {p.client_name && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.client_name}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Services */}
                    <td style={{ padding: "14px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {tags.length === 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>}
                        {tags.map(tag => {
                          const tc = SERVICE_COLORS[tag] || { color: "#c97d2a", bg: "rgba(201,125,42,0.1)" };
                          return <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: tc.bg, color: tc.color }}>{tag}</span>;
                        })}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "14px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot }} />
                        {st}
                      </span>
                    </td>

                    {/* Progress */}
                    <td style={{ padding: "14px 14px", minWidth: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: "var(--border2)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", minWidth: 32, textAlign: "right" }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{done}/{tasks.length} tasks</div>
                    </td>

                    {/* Billed */}
                    <td style={{ padding: "14px 14px", fontSize: 13, fontWeight: 600, color: "var(--blue)" }}>{fmt(billed)}</td>

                    {/* Received */}
                    <td style={{ padding: "14px 14px", fontSize: 13, fontWeight: 600, color: "var(--green)" }}>{fmt(recvd)}</td>

                    {/* Pending */}
                    <td style={{ padding: "14px 14px" }}>
                      {pending > 0
                        ? <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>{fmt(pending)}</span>
                        : pending < 0
                          ? <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>+{fmt(Math.abs(pending))}</span>
                          : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                      }
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px 14px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button className="btn-edit" onClick={e => openEdit(e, p)}>Edit</button>
                        <button className="btn-danger" style={{ padding: "4px 8px" }} onClick={e => deleteProject(e, p.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Row count */}
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
          Showing {sorted.length} of {projects.length} projects
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
                  {["Marketing","Client","Website","SaaS Product"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Client Name (optional)</label>
                <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. Computhink" />
              </div>
            </div>
            <div className="field">
              <label>Project Color</label>
              <div className="color-swatches">
                {PRESET_COLORS.map(c => (
                  <div key={c.value} className={`color-swatch ${form.color===c.value?"selected":""}`}
                    style={{ background: c.value }} onClick={() => setForm(f => ({ ...f, color: c.value }))} title={c.name} />
                ))}
              </div>
            </div>
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
                    }}>{active ? "✓ " : ""}{s}</button>
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
