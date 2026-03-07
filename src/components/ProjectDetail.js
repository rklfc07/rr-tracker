import { useState } from "react";
import { supabase } from "../lib/supabase";

const STATUSES = ["Todo", "In Progress", "Done", "Blocked"];
const STATUS_CFG = {
  "Todo":        { color: "#5a5a72", bg: "rgba(90,90,114,0.15)" },
  "In Progress": { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  "Done":        { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  "Blocked":     { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};
const PRIORITY_CFG = { High: "#ef4444", Medium: "#eab308", Low: "#22c55e" };
const USERS = ["Rakesh", "Raj"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = ["2024","2025","2026","2027"];

function fmt(n) {
  if (!n && n !== 0) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function ProjectDetail({ project, onBack, onRefresh, onLogout }) {
  const [activeTab, setActiveTab] = useState("tasks");
  const [filterUser, setFilterUser] = useState("All");
  const [taskModal, setTaskModal] = useState(null);
  const [noteModal, setNoteModal] = useState(false);
  const [payModal,  setPayModal]  = useState(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [taskForm, setTaskForm] = useState({ title: "", assignee: "Rakesh", status: "Todo", priority: "Medium", due: "", url: "", notes: "" });
  const [noteForm, setNoteForm] = useState({ author: "Rakesh", text: "" });
  const [payForm,  setPayForm]  = useState({ month: MONTHS[now.getMonth()], year: String(now.getFullYear()), amount_due: "", amount_received: "", notes: "" });

  if (!project) return null;

  const tasks    = (project.tasks    || []).filter(t => filterUser === "All" || t.assignee === filterUser);
  const notes    = [...(project.notes || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const payments = [...(project.payments || [])].sort((a, b) => {
    const ma = MONTHS.indexOf(a.month) + Number(a.year) * 12;
    const mb = MONTHS.indexOf(b.month) + Number(b.year) * 12;
    return mb - ma;
  });

  const totalDue      = payments.reduce((s, p) => s + (Number(p.amount_due) || 0), 0);
  const totalReceived = payments.reduce((s, p) => s + (Number(p.amount_received) || 0), 0);
  const totalPending  = totalDue - totalReceived;
  const color = project.color || "#6e5de6";

  const openAddTask  = (status) => { setTaskForm({ title: "", assignee: "Rakesh", status, priority: "Medium", due: "", url: "", notes: "" }); setTaskModal({ mode: "add" }); };
  const openEditTask = (task)   => { setTaskForm({ ...task }); setTaskModal({ mode: "edit", taskId: task.id }); };
  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    if (taskModal.mode === "add") {
      const { error } = await supabase.from("tasks").insert([{ ...taskForm, project_id: project.id }]);
      if (error) { alert("Error adding task: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("tasks").update({ ...taskForm }).eq("id", taskModal.taskId);
      if (error) { alert("Error updating task: " + error.message); setSaving(false); return; }
    }
    setSaving(false); setTaskModal(null); onRefresh();
  };
  const deleteTask = async (id) => { await supabase.from("tasks").delete().eq("id", id); onRefresh(); };

  const saveNote = async () => {
    if (!noteForm.text.trim()) return;
    setSaving(true);
    await supabase.from("notes").insert([{ ...noteForm, project_id: project.id }]);
    setSaving(false); setNoteModal(false); setNoteForm({ author: "Rakesh", text: "" }); onRefresh();
  };
  const deleteNote = async (id) => { await supabase.from("notes").delete().eq("id", id); onRefresh(); };

  const openAddPay  = () => { setPayForm({ month: MONTHS[now.getMonth()], year: String(now.getFullYear()), amount_due: "", amount_received: "", notes: "" }); setPayModal({ mode: "add" }); };
  const openEditPay = (p) => { setPayForm({ ...p }); setPayModal({ mode: "edit", payId: p.id }); };
  const savePay = async () => {
    setSaving(true);
    const data = { ...payForm, amount_due: Number(payForm.amount_due)||0, amount_received: Number(payForm.amount_received)||0, project_id: project.id };
    if (payModal.mode === "add") await supabase.from("payments").insert([data]);
    else await supabase.from("payments").update(data).eq("id", payModal.payId);
    setSaving(false); setPayModal(null); onRefresh();
  };
  const deletePay = async (id) => { await supabase.from("payments").delete().eq("id", id); onRefresh(); };

  const payStatus = (p) => {
    const due = Number(p.amount_due) || 0;
    const rec = Number(p.amount_received) || 0;
    if (rec === 0) return { label: "Pending", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
    if (rec >= due) return { label: "Paid", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
    return { label: "Partial", color: "#eab308", bg: "rgba(234,179,8,0.12)" };
  };

  return (
    <>
      <div className="header">
        <div className="header-brand">
          <button className="back-btn" onClick={onBack}>←</button>
          <div style={{ width: 3, height: 26, background: color, borderRadius: 2 }} />
          <div style={{ minWidth: 0 }}>
            <div className="header-title" style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"calc(100vw - 220px)" }}>{project.name}</div>
            <div className="header-sub">{project.category}{project.client_name ? ` · ${project.client_name}` : ""}</div>
          </div>
        </div>
        <div className="header-actions">
          {activeTab === "tasks" && (
            <>
              <div className="user-tabs">
                {["All", ...USERS].map(u => (
                  <button key={u} className={`user-tab ${filterUser === u ? "active" : ""}`} onClick={() => setFilterUser(u)}>{u}</button>
                ))}
              </div>
              <button className="btn-primary" onClick={() => openAddTask("Todo")}>+ Task</button>
            </>
          )}
          {activeTab === "payments" && <button className="btn-primary" onClick={openAddPay}>+ Payment</button>}
          {activeTab === "notes" && <button className="btn-primary" onClick={() => setNoteModal(true)}>+ Note</button>}
          <button
            onClick={onLogout}
            title="Sign out"
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--muted)", cursor: "pointer", fontSize: 16, padding: "5px 9px",
              lineHeight: 1, transition: "all 0.15s", fontFamily: "sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(192,57,43,0.3)"; e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "var(--red-dim)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "none"; }}
          >⎋</button>
        </div>
      </div>

      <div className="page">
        {/* TABS */}
        <div className="proj-tabs" style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {[
            { id: "tasks",    label: "Tasks",    count: (project.tasks||[]).length },
            { id: "payments", label: "Payments", count: payments.length },
            { id: "notes",    label: "Notes",    count: (project.notes||[]).length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600,
              color: activeTab === tab.id ? "var(--text)" : "var(--muted)",
              borderBottom: activeTab === tab.id ? `2px solid ${color}` : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 7,
            }}>
              {tab.label}
              <span style={{ fontSize: 11, background: activeTab === tab.id ? "var(--surface3)" : "var(--surface2)", padding: "1px 7px", borderRadius: 10, color: activeTab === tab.id ? "var(--text2)" : "var(--muted)" }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <div className="kanban">
            {STATUSES.map(status => {
              const col = tasks.filter(t => t.status === status);
              const cfg = STATUS_CFG[status];
              return (
                <div className="kanban-col" key={status}>
                  <div className="kanban-col-header">
                    <div className="kanban-dot" style={{ background: cfg.color }} />
                    <span className="kanban-col-title" style={{ color: cfg.color }}>{status}</span>
                    <span className="kanban-count">{col.length}</span>
                  </div>
                  {col.map(task => (
                    <div className="task-card" key={task.id} onClick={() => openEditTask(task)}>
                      <div className="task-title">{task.title}</div>
                      <div className="task-footer">
                        <span className="assignee-chip">{task.assignee}</span>
                        <span className="priority-chip" style={{ color: PRIORITY_CFG[task.priority] }}>{task.priority}</span>
                      </div>
                      {task.due && <div className="task-due">📅 {task.due}</div>}
                      {task.url && <div className="task-url">🔗 <a href={task.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{task.url.length > 40 ? task.url.slice(0,40)+"…" : task.url}</a></div>}
                      {task.notes && <div className="task-notes">{task.notes}</div>}
                      <div style={{ marginTop: 10 }}>
                        <button className="btn-danger" onClick={e => { e.stopPropagation(); deleteTask(task.id); }}>Delete</button>
                      </div>
                    </div>
                  ))}
                  <button className="add-task-btn" onClick={() => openAddTask(status)}>+ Add task</button>
                </div>
              );
            })}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === "payments" && (
          <div>
            <div className="finance-cards" style={{ marginBottom: 24 }}>
              <div className="finance-card">
                <div className="fc-label">Total Billed</div>
                <div className="fc-value" style={{ color: "var(--blue)" }}>{fmt(totalDue)}</div>
              </div>
              <div className="finance-card">
                <div className="fc-label">Total Received</div>
                <div className="fc-value" style={{ color: "var(--green)" }}>{fmt(totalReceived)}</div>
              </div>
              <div className="finance-card">
                <div className="fc-label">Outstanding</div>
                <div className="fc-value" style={{ color: totalPending > 0 ? "var(--red)" : "var(--green)" }}>
                  {fmt(Math.abs(totalPending))}
                  <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 6, opacity: 0.7 }}>{totalPending > 0 ? "due" : totalPending < 0 ? "excess" : "✓ clear"}</span>
                </div>
              </div>
            </div>

            {payments.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 13, lineHeight: 2 }}>
                No payments logged yet.<br />
                <button className="btn-primary" style={{ marginTop: 14 }} onClick={openAddPay}>+ Log first payment</button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {payments.map(p => {
                const st  = payStatus(p);
                const due = Number(p.amount_due) || 0;
                const rec = Number(p.amount_received) || 0;
                const bal = due - rec;
                return (
                  <div key={p.id} onClick={() => openEditPay(p)} style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                    padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border2)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    {/* Top row: month/year + status + delete */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px" }}>{p.month} {p.year}</div>
                        {p.notes && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.notes}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                        <button className="btn-danger" onClick={e => { e.stopPropagation(); deletePay(p.id); }} style={{ padding: "4px 8px", fontSize: 12 }}>✕</button>
                      </div>
                    </div>
                    {/* Bottom row: amounts */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                      <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 3 }}>Billed</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--blue)" }}>{fmt(due)}</div>
                      </div>
                      <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 3 }}>Received</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{fmt(rec)}</div>
                      </div>
                      <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 3 }}>Balance</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: bal > 0 ? "var(--red)" : "var(--green)" }}>{fmt(Math.abs(bal))}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div>
            {notes.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 13, lineHeight: 2 }}>
                No notes yet.<br />
                <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => setNoteModal(true)}>+ Add first note</button>
              </div>
            )}
            {notes.map(note => (
              <div className="note-card" key={note.id}>
                <div className="note-meta">
                  <span className="note-author">{note.author}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="note-date">{new Date(note.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <button className="note-delete" onClick={() => deleteNote(note.id)}>✕</button>
                  </div>
                </div>
                <div className="note-text">{note.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TASK MODAL */}
      {taskModal && (
        <div className="modal-backdrop" onClick={() => setTaskModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{taskModal.mode === "add" ? "New Task" : "Edit Task"}</div>
            <div className="field"><label>Title *</label><input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" /></div>
            <div className="field-row">
              <div className="field"><label>Assignee</label>
                <select value={taskForm.assignee} onChange={e => setTaskForm(f => ({ ...f, assignee: e.target.value }))}>
                  {USERS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="field"><label>Status</label>
                <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field"><label>Priority</label>
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                  {["High", "Medium", "Low"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="field"><label>Due Date</label><input type="date" value={taskForm.due} onChange={e => setTaskForm(f => ({ ...f, due: e.target.value }))} /></div>
            </div>
            <div className="field"><label>Reference URL (optional)</label><input type="url" value={taskForm.url} onChange={e => setTaskForm(f => ({ ...f, url: e.target.value }))} placeholder="https://docs.google.com/…" /></div>
            <div className="field"><label>Notes</label><textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any details…" /></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveTask} disabled={saving}>{saving ? "Saving…" : taskModal.mode === "add" ? "Add Task" : "Save"}</button>
              <button className="btn-ghost" onClick={() => setTaskModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {payModal && (
        <div className="modal-backdrop" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{payModal.mode === "add" ? "Log Payment" : "Edit Payment"}</div>
            <div className="field-row">
              <div className="field"><label>Month</label>
                <select value={payForm.month} onChange={e => setPayForm(f => ({ ...f, month: e.target.value }))}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="field"><label>Year</label>
                <select value={payForm.year} onChange={e => setPayForm(f => ({ ...f, year: e.target.value }))}>
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field"><label>Amount Due (₹)</label>
                <input type="number" value={payForm.amount_due} onChange={e => setPayForm(f => ({ ...f, amount_due: e.target.value }))} placeholder="0" />
              </div>
              <div className="field"><label>Amount Received (₹)</label>
                <input type="number" value={payForm.amount_received} onChange={e => setPayForm(f => ({ ...f, amount_received: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {(payForm.amount_due || payForm.amount_received) && (
              <div style={{ padding: "11px 14px", background: "var(--surface2)", borderRadius: 10, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Balance</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: (Number(payForm.amount_due)||0) > (Number(payForm.amount_received)||0) ? "var(--red)" : "var(--green)" }}>
                  {fmt(Math.abs((Number(payForm.amount_due)||0) - (Number(payForm.amount_received)||0)))}
                  {" "}{(Number(payForm.amount_due)||0) > (Number(payForm.amount_received)||0) ? "pending" : "excess"}
                </span>
              </div>
            )}
            <div className="field"><label>Notes (optional)</label><textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Invoice #12, partial advance…" style={{ minHeight: 60 }} /></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={savePay} disabled={saving}>{saving ? "Saving…" : payModal.mode === "add" ? "Log Payment" : "Save"}</button>
              <button className="btn-ghost" onClick={() => setPayModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTE MODAL */}
      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Note / Meeting Log</div>
            <div className="field"><label>Added by</label>
              <select value={noteForm.author} onChange={e => setNoteForm(f => ({ ...f, author: e.target.value }))}>
                {USERS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="field"><label>Note</label><textarea value={noteForm.text} onChange={e => setNoteForm(f => ({ ...f, text: e.target.value }))} placeholder="Meeting summary, decision, follow-up…" style={{ minHeight: 110 }} /></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveNote} disabled={saving}>{saving ? "Saving…" : "Save Note"}</button>
              <button className="btn-ghost" onClick={() => setNoteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
