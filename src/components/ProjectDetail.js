import { useState } from "react";
import { supabase } from "../lib/supabase";

const STATUSES = ["Todo", "In Progress", "Done", "Blocked"];
const STATUS_CFG = {
  "Todo": { color: "#5a5a72", bg: "rgba(90,90,114,0.15)" },
  "In Progress": { color: "#f5c842", bg: "rgba(245,200,66,0.12)" },
  "Done": { color: "#3fcf8e", bg: "rgba(63,207,142,0.12)" },
  "Blocked": { color: "#f7726a", bg: "rgba(247,114,106,0.12)" },
};
const PRIORITY_CFG = { High: "#f7726a", Medium: "#f5c842", Low: "#3fcf8e" };
const USERS = ["Rakesh", "Raj"];

function fmt(n) {
  if (!n) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function ProjectDetail({ project, onBack, onRefresh }) {
  const [filterUser, setFilterUser] = useState("All");
  const [taskModal, setTaskModal] = useState(null); // null | {mode:'add',status} | {mode:'edit',task}
  const [noteModal, setNoteModal] = useState(false);
  const [financeModal, setFinanceModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", assignee: "Rakesh", status: "Todo", priority: "Medium", due: "", notes: "" });
  const [noteForm, setNoteForm] = useState({ author: "Rakesh", text: "" });
  const [financeForm, setFinanceForm] = useState({ budget: project?.budget || "", received: project?.received || "" });
  const [saving, setSaving] = useState(false);

  if (!project) return null;

  const tasks = (project.tasks || []).filter(t => filterUser === "All" || t.assignee === filterUser);
  const notes = [...(project.notes || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const profit = (Number(project.received) || 0) - (Number(project.budget) || 0);
  const pending = (Number(project.budget) || 0) - (Number(project.received) || 0);

  const openAdd = (status) => {
    setTaskForm({ title: "", assignee: "Rakesh", status, priority: "Medium", due: "", notes: "" });
    setTaskModal({ mode: "add" });
  };

  const openEdit = (task) => {
    setTaskForm({ ...task });
    setTaskModal({ mode: "edit", taskId: task.id });
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    if (taskModal.mode === "add") {
      await supabase.from("tasks").insert([{ ...taskForm, project_id: project.id }]);
    } else {
      await supabase.from("tasks").update({ ...taskForm }).eq("id", taskModal.taskId);
    }
    setSaving(false);
    setTaskModal(null);
    onRefresh();
  };

  const deleteTask = async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    onRefresh();
  };

  const saveNote = async () => {
    if (!noteForm.text.trim()) return;
    setSaving(true);
    await supabase.from("notes").insert([{ ...noteForm, project_id: project.id }]);
    setSaving(false);
    setNoteModal(false);
    setNoteForm({ author: "Rakesh", text: "" });
    onRefresh();
  };

  const deleteNote = async (id) => {
    await supabase.from("notes").delete().eq("id", id);
    onRefresh();
  };

  const saveFinance = async () => {
    setSaving(true);
    await supabase.from("projects").update({ budget: Number(financeForm.budget) || 0, received: Number(financeForm.received) || 0 }).eq("id", project.id);
    setSaving(false);
    setFinanceModal(false);
    onRefresh();
  };

  const color = project.color || "#7c6af7";

  return (
    <>
      <div className="header">
        <div className="header-brand">
          <button className="back-btn" onClick={onBack}>←</button>
          <div style={{ width: 4, height: 28, background: color, borderRadius: 2 }} />
          <div>
            <div className="header-title">{project.name}</div>
            <div className="header-sub">{project.category}{project.client_name ? ` · ${project.client_name}` : ""}</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="user-tabs">
            {["All", ...USERS].map(u => (
              <button key={u} className={`user-tab ${filterUser === u ? "active" : ""}`} onClick={() => setFilterUser(u)}>{u}</button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => openAdd("Todo")}>+ Add Task</button>
          <button className="btn-ghost" onClick={() => { setFinanceForm({ budget: project.budget || "", received: project.received || "" }); setFinanceModal(true); }}>₹ Finance</button>
          <button className="btn-ghost" onClick={() => setNoteModal(true)}>+ Note</button>
        </div>
      </div>

      <div className="page">
        {/* Finance Cards */}
        <div className="finance-cards">
          <div className="finance-card">
            <div className="fc-label">Project Budget</div>
            <div className="fc-value" style={{ color: "var(--blue)" }}>{fmt(project.budget)}</div>
          </div>
          <div className="finance-card">
            <div className="fc-label">Amount Received</div>
            <div className="fc-value" style={{ color: "var(--green)" }}>{fmt(project.received)}</div>
          </div>
          <div className="finance-card">
            <div className="fc-label">Pending / Profit</div>
            <div className="fc-value" style={{ color: pending > 0 ? "var(--red)" : "var(--green)" }}>{fmt(Math.abs(pending))} {pending > 0 ? "due" : "profit"}</div>
          </div>
        </div>

        {/* Kanban */}
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
                  <div className="task-card" key={task.id} onClick={() => openEdit(task)}>
                    <div className="task-title">{task.title}</div>
                    <div className="task-footer">
                      <span className="assignee-chip">{task.assignee}</span>
                      <span className="priority-chip" style={{ color: PRIORITY_CFG[task.priority] }}>{task.priority}</span>
                    </div>
                    {task.due && <div className="task-due">📅 {task.due}</div>}
                    {task.notes && <div className="task-notes">{task.notes}</div>}
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-danger" style={{ fontSize: 11, padding: "3px 10px" }} onClick={e => { e.stopPropagation(); deleteTask(task.id); }}>Delete</button>
                    </div>
                  </div>
                ))}
                <button className="add-task-btn" onClick={() => openAdd(status)}>+ Add task</button>
              </div>
            );
          })}
        </div>

        {/* Notes */}
        <div className="notes-section">
          <div className="notes-header">
            <div className="section-title">Meeting Notes & Logs</div>
            <button className="btn-primary" onClick={() => setNoteModal(true)}>+ Add Note</button>
          </div>
          {notes.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0" }}>No notes yet. Add your first meeting log.</div>}
          {notes.map(note => (
            <div className="note-card" key={note.id}>
              <div className="note-meta">
                <span className="note-author">{note.author}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="note-date">{new Date(note.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <button className="note-delete" onClick={() => deleteNote(note.id)}>✕</button>
                </div>
              </div>
              <div className="note-text">{note.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Modal */}
      {taskModal && (
        <div className="modal-backdrop" onClick={() => setTaskModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{taskModal.mode === "add" ? "New Task" : "Edit Task"}</div>
            <div className="field"><label>Task Title *</label><input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" /></div>
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
            <div className="field"><label>Notes</label><textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any details…" /></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveTask} disabled={saving}>{saving ? "Saving…" : taskModal.mode === "add" ? "Add Task" : "Save Changes"}</button>
              <button className="btn-ghost" onClick={() => setTaskModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Note / Meeting Log</div>
            <div className="field"><label>Who is adding this?</label>
              <select value={noteForm.author} onChange={e => setNoteForm(f => ({ ...f, author: e.target.value }))}>
                {USERS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="field"><label>Note / Log</label><textarea value={noteForm.text} onChange={e => setNoteForm(f => ({ ...f, text: e.target.value }))} placeholder="Meeting summary, decision, follow-up, anything…" style={{ minHeight: 120 }} /></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveNote} disabled={saving}>{saving ? "Saving…" : "Save Note"}</button>
              <button className="btn-ghost" onClick={() => setNoteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Finance Modal */}
      {financeModal && (
        <div className="modal-backdrop" onClick={() => setFinanceModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Update Financials</div>
            <div className="field"><label>Project Budget (₹)</label><input type="number" value={financeForm.budget} onChange={e => setFinanceForm(f => ({ ...f, budget: e.target.value }))} placeholder="0" /></div>
            <div className="field"><label>Amount Received (₹)</label><input type="number" value={financeForm.received} onChange={e => setFinanceForm(f => ({ ...f, received: e.target.value }))} placeholder="0" /></div>
            <div style={{ marginTop: 12, padding: 14, background: "var(--surface2)", borderRadius: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--muted)" }}>Pending Amount</span>
                <span style={{ color: "var(--red)", fontWeight: 600 }}>{fmt((Number(financeForm.budget) || 0) - (Number(financeForm.received) || 0))}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveFinance} disabled={saving}>{saving ? "Saving…" : "Update"}</button>
              <button className="btn-ghost" onClick={() => setFinanceModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
