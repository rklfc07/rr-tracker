import { useState } from "react";
import { supabase } from "../lib/supabase";

const CATEGORIES = ["SEO", "Google Ads", "SaaS Product", "Website Development", "Content Writing"];
const CAT_COLORS = {
  "SEO":                  { color: "#2d7a4a", accent: "#2d7a4a" },
  "Google Ads":           { color: "#2563a8", accent: "#2563a8" },
  "SaaS Product":         { color: "#0891b2", accent: "#0891b2" },
  "Website Development":  { color: "#c97d2a", accent: "#c97d2a" },
  "Content Writing":      { color: "#c0392b", accent: "#c0392b" },
};
const SERVICES = ["SaaS Product", "Marketing", "Website"];
const SVC_COLORS = {
  "SaaS Product": { color: "#0891b2", bg: "rgba(8,145,178,0.1)" },
  "Marketing":    { color: "#9333ea", bg: "rgba(147,51,234,0.1)" },
  "Website":      { color: "#c97d2a", bg: "rgba(201,125,42,0.1)" },
};
const PRESET_COLORS = [
  { name: "Amber",  value: "#c97d2a" },
  { name: "Green",  value: "#2d7a4a" },
  { name: "Red",    value: "#c0392b" },
  { name: "Blue",   value: "#2563a8" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Orange", value: "#ea580c" },
];
const EMPTY_FORM = { name: "", category: "Google Ads", service: "Marketing", client_name: "", color: "#c97d2a", budget: "", received: "" };

function fmt(n) {
  if (!n && n !== 0) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function Dashboard({ projects, onSelectProject, onRefresh }) {
  const [view, setView] = useState("categories"); // "categories" | "projects"
  const [activeCategory, setActiveCategory] = useState(null);
  const [userFilter, setUserFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const totalBilled   = projects.reduce((s,p) => s+(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_due)||0),0),0);
  const totalReceived = projects.reduce((s,p) => s+(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_received)||0),0),0);
  const totalPending  = Math.max(0, totalBilled - totalReceived);

  // Projects filtered by active category
  const categoryProjects = activeCategory ? projects.filter(p => p.category === activeCategory) : [];
  const filteredProjects = categoryProjects.filter(p => {
    if (userFilter !== "All" && !(p.tasks||[]).some(t => t.assignee === userFilter)) return false;
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase()) && !(p.client_name||"").toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });
  const sorted = [...filteredProjects].sort((a, b) => {
    let va, vb;
    if (sortBy === "name")     { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    if (sortBy === "service")  { va = a.service||""; vb = b.service||""; }
    if (sortBy === "billed")   { va = (a.payments||[]).reduce((s,x)=>s+(Number(x.amount_due)||0),0); vb = (b.payments||[]).reduce((s,x)=>s+(Number(x.amount_due)||0),0); }
    if (sortBy === "received") { va = (a.payments||[]).reduce((s,x)=>s+(Number(x.amount_received)||0),0); vb = (b.payments||[]).reduce((s,x)=>s+(Number(x.amount_received)||0),0); }
    if (sortBy === "pending")  {
      const pend = p => (p.payments||[]).reduce((s,x)=>s+(Number(x.amount_due)||0),0)-(p.payments||[]).reduce((s,x)=>s+(Number(x.amount_received)||0),0);
      va = pend(a); vb = pend(b);
    }
    if (va < vb) return sortDir==="asc"?-1:1;
    if (va > vb) return sortDir==="asc"?1:-1;
    return 0;
  });

  const toggleSort = (col) => { if (sortBy===col) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortBy(col); setSortDir("asc"); } };
  const sortIcon = col => sortBy===col?(sortDir==="asc"?" ↑":" ↓"):"";

  const openAdd  = () => { setForm({ ...EMPTY_FORM, category: activeCategory || "Google Ads" }); setEditingProject(null); setModalMode("add"); };
  const openEdit = (e, p) => {
    e.stopPropagation();
    setForm({ name:p.name, category:p.category||"Google Ads", service:p.service||"Marketing", client_name:p.client_name||"", color:p.color||"#c97d2a", budget:p.budget||"", received:p.received||"" });
    setEditingProject(p); setModalMode("edit");
  };
  const saveProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { name:form.name, category:form.category, service:form.service, client_name:form.client_name, color:form.color, budget:Number(form.budget)||0, received:Number(form.received)||0 };
    if (modalMode==="add") await supabase.from("projects").insert([data]);
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

  const thStyle = (col) => ({
    padding:"11px 16px", textAlign:"left", fontSize:11, fontWeight:700,
    color: sortBy===col?"var(--accent)":"var(--muted)",
    textTransform:"uppercase", letterSpacing:"0.08em", cursor: col?"pointer":"default",
    whiteSpace:"nowrap", userSelect:"none",
    background:"var(--surface2)", borderBottom:"1px solid var(--border)",
  });

  // ── CATEGORY VIEW ──────────────────────────────────────────
  const CategoryView = () => (
    <div className="page">
      <div className="stats-grid">
        {[
          { label:"Total Projects", value:projects.length,    color:"#1a1a14" },
          { label:"Total Billed",   value:fmt(totalBilled),   color:"#2563a8" },
          { label:"Total Received", value:fmt(totalReceived), color:"#2d7a4a" },
          { label:"Total Pending",  value:fmt(totalPending),  color:"#c0392b" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div><div className="stat-label">{s.label}</div><div className="stat-value" style={{ color:s.color }}>{s.value}</div></div>
            <div className="stat-bar" style={{ background:s.color }} />
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:20 }}>
        <button className="btn-primary" onClick={openAdd}>+ New Project</button>
      </div>

      {/* Category rows — desktop table */}
      <div className="table-desktop" style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle(""), width:48, textAlign:"center", cursor:"default" }}>#</th>
              <th style={{ ...thStyle(""), cursor:"default" }}>Category</th>
              <th style={{ ...thStyle(""), textAlign:"center", cursor:"default" }}>Projects</th>
              <th style={{ ...thStyle(""), cursor:"default" }}>Billed</th>
              <th style={{ ...thStyle(""), cursor:"default" }}>Received</th>
              <th style={{ ...thStyle(""), cursor:"default" }}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat, i) => {
              const catProjects = projects.filter(p => p.category === cat);
              const billed   = catProjects.reduce((s,p)=>(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_due)||0),s),0);
              const received = catProjects.reduce((s,p)=>(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_received)||0),s),0);
              const pending  = billed - received;
              const cfg = CAT_COLORS[cat] || { color:"#8a8a72" };
              return (
                <tr key={cat}
                  onClick={() => { setActiveCategory(cat); setView("projects"); setSearchText(""); }}
                  style={{ borderTop:"1px solid var(--border)", cursor:"pointer", transition:"background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--surface2)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}
                >
                  <td style={{ padding:"16px", textAlign:"center", fontSize:12, color:"var(--muted)", fontWeight:500 }}>{i+1}</td>
                  <td style={{ padding:"16px 18px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:4, height:36, borderRadius:2, background:cfg.color, flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"var(--text)", letterSpacing:"-0.2px" }}>{cat}</div>
                        <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{catProjects.length} project{catProjects.length!==1?"s":""}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"16px", textAlign:"center" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:cfg.color }}>{catProjects.length}</span>
                  </td>
                  <td style={{ padding:"16px 18px", fontSize:13, fontWeight:600, color:"var(--blue)" }}>{fmt(billed)}</td>
                  <td style={{ padding:"16px 18px", fontSize:13, fontWeight:600, color:"var(--green)" }}>{fmt(received)}</td>
                  <td style={{ padding:"16px 18px" }}>
                    {pending > 0
                      ? <span style={{ fontSize:13, fontWeight:700, color:"var(--red)" }}>{fmt(pending)}</span>
                      : <span style={{ fontSize:12, color:"var(--muted)" }}>—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:"2px solid var(--border2)", background:"var(--surface2)" }}>
              <td colSpan={3} style={{ padding:"12px 18px", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em" }}>Grand Total — {projects.length} projects</td>
              <td style={{ padding:"12px 18px", fontSize:13, fontWeight:800, color:"var(--blue)" }}>{fmt(totalBilled)}</td>
              <td style={{ padding:"12px 18px", fontSize:13, fontWeight:800, color:"var(--green)" }}>{fmt(totalReceived)}</td>
              <td style={{ padding:"12px 18px", fontSize:13, fontWeight:800, color:"var(--red)" }}>{fmt(totalPending)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Category rows — mobile cards */}
      <div className="mobile-cards">
        {CATEGORIES.map((cat, i) => {
          const catProjects = projects.filter(p => p.category === cat);
          const billed   = catProjects.reduce((s,p)=>(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_due)||0),s),0);
          const received = catProjects.reduce((s,p)=>(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_received)||0),s),0);
          const pending  = billed - received;
          const cfg = CAT_COLORS[cat] || { color:"#8a8a72" };
          return (
            <div key={cat}
              onClick={() => { setActiveCategory(cat); setView("projects"); setSearchText(""); }}
              style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 16px", cursor:"pointer", position:"relative", overflow:"hidden" }}
            >
              <div style={{ position:"absolute", top:0, left:0, bottom:0, width:3, background:cfg.color, borderRadius:"3px 0 0 3px" }} />
              <div style={{ paddingLeft:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", letterSpacing:"-0.2px" }}>{cat}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{catProjects.length} project{catProjects.length!==1?"s":""}</div>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:cfg.color, background:`${cfg.color}18`, padding:"3px 10px", borderRadius:20 }}>{catProjects.length}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:3 }}>Billed</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--blue)" }}>{fmt(billed)}</div>
                  </div>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:3 }}>Received</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--green)" }}>{fmt(received)}</div>
                  </div>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:3 }}>Pending</div>
                    <div style={{ fontSize:13, fontWeight:700, color: pending>0?"var(--red)":"var(--muted)" }}>{pending>0?fmt(pending):"—"}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* Grand total card */}
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border2)", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Grand Total — {projects.length} projects</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
            <div><div style={{ fontSize:9, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Billed</div><div style={{ fontSize:13, fontWeight:800, color:"var(--blue)" }}>{fmt(totalBilled)}</div></div>
            <div><div style={{ fontSize:9, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Received</div><div style={{ fontSize:13, fontWeight:800, color:"var(--green)" }}>{fmt(totalReceived)}</div></div>
            <div><div style={{ fontSize:9, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Pending</div><div style={{ fontSize:13, fontWeight:800, color:"var(--red)" }}>{fmt(totalPending)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── PROJECTS VIEW ──────────────────────────────────────────
  const catCfgActive = CAT_COLORS[activeCategory] || { color:"#8a8a72" };
  const catBilled   = sorted.reduce((s,p)=>(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_due)||0),s),0);
  const catReceived = sorted.reduce((s,p)=>(p.payments||[]).reduce((a,x)=>a+(Number(x.amount_received)||0),s),0);
  const catPending  = Math.max(0, catBilled - catReceived);

  const ProjectsView = () => (
    <div className="page">
      {/* Mini stats for this category */}
      <div className="stats-grid" style={{ marginBottom:20 }}>
        {[
          { label:`${activeCategory} Projects`, value:categoryProjects.length, color:catCfgActive.color },
          { label:"Billed",   value:fmt(catBilled),   color:"#2563a8" },
          { label:"Received", value:fmt(catReceived), color:"#2d7a4a" },
          { label:"Pending",  value:fmt(catPending),  color:"#c0392b" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div><div className="stat-label">{s.label}</div><div className="stat-value" style={{ color:s.color }}>{s.value}</div></div>
            <div className="stat-bar" style={{ background:s.color }} />
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ marginBottom:18 }}>
        <input className="search-input" placeholder="Search projects…" value={searchText} onChange={e => setSearchText(e.target.value)} />
        <button className="btn-primary" onClick={openAdd}>+ New Project</button>
      </div>

      {/* Projects table — desktop */}
      <div className="table-desktop" style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
        <div className="table-scroll">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle(""), width:48, textAlign:"center", cursor:"default" }}>#</th>
              <th style={thStyle("name")}     onClick={() => toggleSort("name")}>Project{sortIcon("name")}</th>
              <th style={thStyle("service")}  onClick={() => toggleSort("service")}>Service{sortIcon("service")}</th>
              <th style={thStyle("billed")}   onClick={() => toggleSort("billed")}>Billed{sortIcon("billed")}</th>
              <th style={thStyle("received")} onClick={() => toggleSort("received")}>Received{sortIcon("received")}</th>
              <th style={thStyle("pending")}  onClick={() => toggleSort("pending")}>Pending{sortIcon("pending")}</th>
              <th style={{ ...thStyle(""), cursor:"default", width:90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={7} style={{ padding:"48px", textAlign:"center", color:"var(--muted)", fontSize:13 }}>
                No projects in this category yet. <button className="btn-primary" style={{ marginLeft:10 }} onClick={openAdd}>+ Add one</button>
              </td></tr>
            )}
            {sorted.map((p, i) => {
              const pays    = p.payments || [];
              const billed  = pays.reduce((s,x)=>s+(Number(x.amount_due)||0),0);
              const recvd   = pays.reduce((s,x)=>s+(Number(x.amount_received)||0),0);
              const pending = billed - recvd;
              const color   = p.color || "#c97d2a";
              const svcCfg  = SVC_COLORS[p.service] || { color:"#8a8a72", bg:"rgba(138,138,114,0.1)" };
              return (
                <tr key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  style={{ borderTop:"1px solid var(--border)", cursor:"pointer", transition:"background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--surface2)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}
                >
                  <td style={{ padding:"14px 16px", textAlign:"center", fontSize:12, color:"var(--muted)", fontWeight:500 }}>{i+1}</td>
                  <td style={{ padding:"14px 16px", minWidth:200 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:3, height:34, borderRadius:2, background:color, flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", letterSpacing:"-0.2px" }}>{p.name}</div>
                        {p.client_name && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{p.client_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    {p.service
                      ? <span style={{ fontSize:11, fontWeight:700, padding:"4px 11px", borderRadius:20, background:svcCfg.bg, color:svcCfg.color }}>{p.service}</span>
                      : <span style={{ fontSize:12, color:"var(--muted)" }}>—</span>
                    }
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:13, fontWeight:600, color:"var(--blue)" }}>{fmt(billed)}</td>
                  <td style={{ padding:"14px 16px", fontSize:13, fontWeight:600, color:"var(--green)" }}>{fmt(recvd)}</td>
                  <td style={{ padding:"14px 16px" }}>
                    {pending>0
                      ? <span style={{ fontSize:13, fontWeight:700, color:"var(--red)" }}>{fmt(pending)}</span>
                      : pending<0
                        ? <span style={{ fontSize:13, fontWeight:700, color:"var(--green)" }}>+{fmt(Math.abs(pending))}</span>
                        : <span style={{ fontSize:12, color:"var(--muted)" }}>—</span>
                    }
                  </td>
                  <td style={{ padding:"14px 16px" }} onClick={e=>e.stopPropagation()}>
                    <div style={{ display:"flex", gap:5 }}>
                      <button className="btn-edit" onClick={e=>openEdit(e,p)}>Edit</button>
                      <button className="btn-danger" style={{ padding:"4px 8px" }} onClick={e=>deleteProject(e,p.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr style={{ borderTop:"2px solid var(--border2)", background:"var(--surface2)" }}>
                <td colSpan={3} style={{ padding:"12px 16px", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                  Total — {sorted.length} projects
                </td>
                <td style={{ padding:"12px 16px", fontSize:13, fontWeight:800, color:"var(--blue)" }}>{fmt(catBilled)}</td>
                <td style={{ padding:"12px 16px", fontSize:13, fontWeight:800, color:"var(--green)" }}>{fmt(catReceived)}</td>
                <td style={{ padding:"12px 16px", fontSize:13, fontWeight:800, color:"var(--red)" }}>{fmt(catPending)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      {/* Projects — mobile cards */}
      <div className="mobile-cards">
        {sorted.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--muted)", fontSize:13 }}>
            No projects yet. <button className="btn-primary" style={{ marginLeft:8 }} onClick={openAdd}>+ Add one</button>
          </div>
        )}
        {sorted.map((p, i) => {
          const pays    = p.payments || [];
          const billed  = pays.reduce((s,x)=>s+(Number(x.amount_due)||0),0);
          const recvd   = pays.reduce((s,x)=>s+(Number(x.amount_received)||0),0);
          const pending = billed - recvd;
          const color   = p.color || "#c97d2a";
          const svcCfg  = SVC_COLORS[p.service] || { color:"#8a8a72", bg:"rgba(138,138,114,0.1)" };
          return (
            <div key={p.id}
              onClick={() => onSelectProject(p.id)}
              style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 16px", cursor:"pointer", position:"relative", overflow:"hidden" }}
            >
              <div style={{ position:"absolute", top:0, left:0, bottom:0, width:3, background:color }} />
              <div style={{ paddingLeft:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ flex:1, minWidth:0, paddingRight:8 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", letterSpacing:"-0.2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                    {p.client_name && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{p.client_name}</div>}
                  </div>
                  <div style={{ display:"flex", gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                    <button className="btn-edit" onClick={e=>openEdit(e,p)}>Edit</button>
                    <button className="btn-danger" style={{ padding:"4px 8px" }} onClick={e=>deleteProject(e,p.id)}>✕</button>
                  </div>
                </div>
                {p.service && <div style={{ marginBottom:10 }}><span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:svcCfg.bg, color:svcCfg.color }}>{p.service}</span></div>}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:3 }}>Billed</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--blue)" }}>{fmt(billed)}</div>
                  </div>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:3 }}>Received</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--green)" }}>{fmt(recvd)}</div>
                  </div>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600, marginBottom:3 }}>Pending</div>
                    <div style={{ fontSize:13, fontWeight:700, color: pending>0?"var(--red)":pending<0?"var(--green)":"var(--muted)" }}>{pending>0?fmt(pending):pending<0?`+${fmt(Math.abs(pending))}`:"—"}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {sorted.length > 0 && (
          <div style={{ background:"var(--surface2)", border:"1px solid var(--border2)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Total — {sorted.length} projects</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
              <div><div style={{ fontSize:9, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Billed</div><div style={{ fontSize:13, fontWeight:800, color:"var(--blue)" }}>{fmt(catBilled)}</div></div>
              <div><div style={{ fontSize:9, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Received</div><div style={{ fontSize:13, fontWeight:800, color:"var(--green)" }}>{fmt(catReceived)}</div></div>
              <div><div style={{ fontSize:9, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Pending</div><div style={{ fontSize:13, fontWeight:800, color:"var(--red)" }}>{fmt(catPending)}</div></div>
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop:10, fontSize:12, color:"var(--muted)", textAlign:"right" }}>{sorted.length} of {categoryProjects.length} projects</div>
    </div>
  );

  return (
    <>
      <div className="header">
        <div className="header-brand">
          {view === "projects" && (
            <button className="back-btn" onClick={() => { setView("categories"); setActiveCategory(null); }}>←</button>
          )}
          <div className="header-logo">R²</div>
          <div>
            <div className="header-title">
              {view === "categories" ? "Rakesh & Raj" : activeCategory}
            </div>
            <div className="header-sub">
              {view === "categories" ? "Workspace" : "← All Categories"}
            </div>
          </div>
        </div>
        <div className="header-actions">
          <div className="user-tabs">
            {["All","Rakesh","Raj"].map(u => (
              <button key={u} className={`user-tab ${userFilter===u?"active":""}`} onClick={() => setUserFilter(u)}>{u}</button>
            ))}
          </div>
        </div>
      </div>

      {view === "categories" ? <CategoryView /> : <ProjectsView />}

      {/* ADD / EDIT MODAL */}
      {modalMode && (
        <div className="modal-backdrop" onClick={() => setModalMode(null)}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{modalMode==="add"?"New Project":"Edit Project"}</div>
            <div className="field"><label>Project Name *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Google Ads – Computhink" />
            </div>
            <div className="field-row">
              <div className="field"><label>Category</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Service Type</label>
                <select value={form.service} onChange={e=>setForm(f=>({...f,service:e.target.value}))}>
                  {SERVICES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Client Name (optional)</label>
              <input value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))} placeholder="e.g. Computhink" />
            </div>
            <div className="field">
              <label>Project Color</label>
              <div className="color-swatches">
                {PRESET_COLORS.map(c=>(
                  <div key={c.value} className={`color-swatch ${form.color===c.value?"selected":""}`}
                    style={{ background:c.value }} onClick={()=>setForm(f=>({...f,color:c.value}))} title={c.name} />
                ))}
              </div>
            </div>
            <div className="field-row">
              <div className="field"><label>Project Budget (₹)</label>
                <input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} placeholder="0" />
              </div>
              <div className="field"><label>Amount Received (₹)</label>
                <input type="number" value={form.received} onChange={e=>setForm(f=>({...f,received:e.target.value}))} placeholder="0" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveProject} disabled={saving}>{saving?"Saving…":modalMode==="add"?"Create Project":"Save Changes"}</button>
              <button className="btn-ghost" onClick={()=>setModalMode(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
