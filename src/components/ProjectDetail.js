import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const STATUSES = ["Todo", "In Progress", "Done", "Blocked"];
const STATUS_CFG = {
  "Todo":        { color: "#5a5a72", bg: "rgba(90,90,114,0.15)" },
  "In Progress": { color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  "Done":        { color: "#2d7a4a", bg: "rgba(45,122,74,0.12)" },
  "Blocked":     { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};
const PRIORITY_CFG = { High: "#ef4444", Medium: "#d97706", Low: "#2d7a4a" };
const USERS = ["Rakesh", "Raj"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = ["2024","2025","2026","2027"];

function fmt(n) {
  if (!n && n !== 0) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { color: "#8a8a72", bg: "rgba(138,138,114,0.1)" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:cfg.bg, color:cfg.color }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.color, display:"inline-block" }} />
      {status}
    </span>
  );
}

function PriBadge({ priority }) {
  const color = PRIORITY_CFG[priority] || "#8a8a72";
  return <span style={{ fontSize:11, fontWeight:700, color }}>● {priority}</span>;
}

export default function ProjectDetail({ project, onBack, onRefresh, onLogout }) {
  const isMobile = useIsMobile();

  const [activeTab,  setActiveTab]  = useState("tasks");
  const [filterUser, setFilterUser] = useState("All");
  const [sortCol,    setSortCol]    = useState("status");
  const [sortDir,    setSortDir]    = useState("asc");
  const [selectedTask, setSelectedTask] = useState(null);

  const [taskModal, setTaskModal] = useState(null);
  const [noteModal, setNoteModal] = useState(false);
  const [payModal,  setPayModal]  = useState(null);
  const [saving,    setSaving]    = useState(false);

  const now = new Date();
  const [taskForm, setTaskForm] = useState({ title:"", assignee:"Rakesh", status:"Todo", priority:"Medium", due:"", url:"", notes:"" });
  const [noteForm, setNoteForm] = useState({ author:"Rakesh", text:"" });
  const [payForm,  setPayForm]  = useState({ month:MONTHS[now.getMonth()], year:String(now.getFullYear()), amount_due:"", amount_received:"", notes:"" });

  if (!project) return null;

  const allTasks = project.tasks || [];
  const tasks = allTasks
    .filter(t => filterUser === "All" || t.assignee === filterUser)
    .sort((a, b) => {
      const statusOrder = { "In Progress":0, "Blocked":1, "Todo":2, "Done":3 };
      if (sortCol === "status")   { const d = (statusOrder[a.status]??99)-(statusOrder[b.status]??99); return sortDir==="asc"?d:-d; }
      if (sortCol === "priority") { const po={High:0,Medium:1,Low:2}; const d=(po[a.priority]??99)-(po[b.priority]??99); return sortDir==="asc"?d:-d; }
      if (sortCol === "assignee") { return sortDir==="asc"?a.assignee.localeCompare(b.assignee):b.assignee.localeCompare(a.assignee); }
      if (sortCol === "due")      { return sortDir==="asc"?(a.due||"").localeCompare(b.due||""):(b.due||"").localeCompare(a.due||""); }
      if (sortCol === "title")    { return sortDir==="asc"?a.title.localeCompare(b.title):b.title.localeCompare(a.title); }
      return 0;
    });

  const notes = [...(project.notes||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const payments = [...(project.payments||[])].sort((a,b)=>{
    return (MONTHS.indexOf(b.month)+Number(b.year)*12)-(MONTHS.indexOf(a.month)+Number(a.year)*12);
  });

  const totalDue      = payments.reduce((s,p)=>s+(Number(p.amount_due)||0),0);
  const totalReceived = payments.reduce((s,p)=>s+(Number(p.amount_received)||0),0);
  const totalPending  = totalDue - totalReceived;
  const color = project.color || "#c97d2a";

  const toggleSort = (col) => { if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortCol(col); setSortDir("asc"); }};
  const sortIcon   = col => sortCol===col?(sortDir==="asc"?" ↑":" ↓"):"";

  const openAddTask  = () => { setTaskForm({title:"",assignee:"Rakesh",status:"Todo",priority:"Medium",due:"",url:"",notes:""}); setTaskModal({mode:"add"}); };
  const openEditTask = (task) => { setTaskForm({...task}); setTaskModal({mode:"edit",taskId:task.id}); setSelectedTask(null); };
  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    if (taskModal.mode==="add") await supabase.from("tasks").insert([{...taskForm,project_id:project.id}]);
    else await supabase.from("tasks").update({...taskForm}).eq("id",taskModal.taskId);
    setSaving(false); setTaskModal(null); onRefresh();
  };
  const deleteTask = async (id) => { await supabase.from("tasks").delete().eq("id",id); setSelectedTask(null); onRefresh(); };

  const saveNote = async () => {
    if (!noteForm.text.trim()) return;
    setSaving(true);
    await supabase.from("notes").insert([{...noteForm,project_id:project.id}]);
    setSaving(false); setNoteModal(false); setNoteForm({author:"Rakesh",text:""}); onRefresh();
  };
  const deleteNote = async (id) => { await supabase.from("notes").delete().eq("id",id); onRefresh(); };

  const openAddPay  = () => { setPayForm({month:MONTHS[now.getMonth()],year:String(now.getFullYear()),amount_due:"",amount_received:"",notes:""}); setPayModal({mode:"add"}); };
  const openEditPay = (p) => { setPayForm({...p}); setPayModal({mode:"edit",payId:p.id}); };
  const savePay = async () => {
    setSaving(true);
    const data = {...payForm,amount_due:Number(payForm.amount_due)||0,amount_received:Number(payForm.amount_received)||0,project_id:project.id};
    if (payModal.mode==="add") await supabase.from("payments").insert([data]);
    else await supabase.from("payments").update(data).eq("id",payModal.payId);
    setSaving(false); setPayModal(null); onRefresh();
  };
  const deletePay = async (id) => { await supabase.from("payments").delete().eq("id",id); onRefresh(); };

  const payStatus = (p) => {
    const due=Number(p.amount_due)||0, rec=Number(p.amount_received)||0;
    if (rec===0) return {label:"Pending",color:"#ef4444",bg:"rgba(239,68,68,0.12)"};
    if (rec>=due) return {label:"Paid",color:"#2d7a4a",bg:"rgba(45,122,74,0.12)"};
    return {label:"Partial",color:"#d97706",bg:"rgba(217,119,6,0.12)"};
  };

  const thStyle = (col) => ({
    padding:"9px 14px", textAlign:"left", fontSize:10, fontWeight:700,
    color:sortCol===col?"var(--accent)":"var(--muted)",
    textTransform:"uppercase", letterSpacing:"0.08em",
    background:"var(--surface2)", borderBottom:"1px solid var(--border2)",
    cursor:col?"pointer":"default", userSelect:"none", whiteSpace:"nowrap",
  });

  const TaskDetail = ({ task, onClose }) => (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"18px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800,letterSpacing:"-0.3px",color:"var(--text)",lineHeight:1.35,marginBottom:8}}>{task.title}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <StatusBadge status={task.status}/>
            <PriBadge priority={task.priority}/>
          </div>
        </div>
        <button onClick={onClose} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--muted)",cursor:"pointer",flexShrink:0}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"var(--surface2)",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Assignee</div>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:task.assignee==="Rakesh"?"rgba(37,99,168,0.15)":"rgba(45,122,74,0.15)",color:task.assignee==="Rakesh"?"#2563a8":"#2d7a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800}}>{task.assignee[0]}</div>
              <span style={{fontSize:13,fontWeight:600}}>{task.assignee}</span>
            </div>
          </div>
          <div style={{background:"var(--surface2)",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Due Date</div>
            <div style={{fontSize:13,fontWeight:600,color:task.due&&new Date(task.due)<new Date()&&task.status!=="Done"?"var(--red)":"var(--text)"}}>
              {task.due?new Date(task.due).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"—"}
              {task.due&&new Date(task.due)<new Date()&&task.status!=="Done"&&<span style={{fontSize:10,marginLeft:4}}>⚠ Overdue</span>}
            </div>
          </div>
        </div>
        {task.url&&(
          <div style={{background:"var(--surface2)",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Reference</div>
            <a href={task.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--accent)",fontWeight:500,textDecoration:"none",wordBreak:"break-all"}}>🔗 {task.url.length>50?task.url.slice(0,50)+"…":task.url}</a>
          </div>
        )}
        {task.notes&&(
          <div style={{background:"var(--surface2)",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Notes</div>
            <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.65}}>{task.notes}</div>
          </div>
        )}
        {!task.url&&!task.notes&&<div style={{fontSize:12,color:"var(--muted)",textAlign:"center",padding:"16px 0"}}>No additional details.</div>}
      </div>
      <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:8}}>
        <button onClick={()=>openEditTask(task)} style={{flex:1,padding:"9px",borderRadius:8,background:"var(--text)",color:"var(--bg)",border:"none",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>✏ Edit Task</button>
        <button onClick={()=>{if(window.confirm("Delete this task?"))deleteTask(task.id);}} style={{padding:"9px 14px",borderRadius:8,background:"rgba(192,57,43,0.1)",color:"var(--red)",border:"1px solid rgba(192,57,43,0.2)",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>🗑</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="header">
        <div className="header-brand">
          <button className="back-btn" onClick={onBack}>←</button>
          <div style={{width:3,height:26,background:color,borderRadius:2}}/>
          <div style={{minWidth:0}}>
            <div className="header-title" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"calc(100vw - 220px)"}}>{project.name}</div>
            <div className="header-sub">{project.category}{project.client_name?` · ${project.client_name}`:""}</div>
          </div>
        </div>
        <div className="header-actions">
          {activeTab==="tasks"&&<><div className="user-tabs">{["All",...USERS].map(u=><button key={u} className={`user-tab ${filterUser===u?"active":""}`} onClick={()=>setFilterUser(u)}>{u}</button>)}</div><button className="btn-primary" onClick={openAddTask}>+ Task</button></>}
          {activeTab==="payments"&&<button className="btn-primary" onClick={openAddPay}>+ Payment</button>}
          {activeTab==="notes"&&<button className="btn-primary" onClick={()=>setNoteModal(true)}>+ Note</button>}
          {onLogout&&<button onClick={onLogout} title="Sign out" style={{background:"none",border:"1px solid var(--border)",borderRadius:8,color:"var(--muted)",cursor:"pointer",fontSize:16,padding:"5px 9px",lineHeight:1,transition:"all 0.15s",fontFamily:"sans-serif"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(192,57,43,0.3)";e.currentTarget.style.color="var(--red)";e.currentTarget.style.background="var(--red-dim)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--muted)";e.currentTarget.style.background="none";}}>⎋</button>}
        </div>
      </div>

      <div className="page">
        <div className="proj-tabs" style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1px solid var(--border)",overflowX:"auto"}}>
          {[{id:"tasks",label:"Tasks",count:allTasks.length},{id:"payments",label:"Payments",count:payments.length},{id:"notes",label:"Notes",count:(project.notes||[]).length}].map(tab=>(
            <button key={tab.id} onClick={()=>{setActiveTab(tab.id);setSelectedTask(null);}} style={{padding:"10px 20px",border:"none",background:"none",cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:13,fontWeight:600,color:activeTab===tab.id?"var(--text)":"var(--muted)",borderBottom:activeTab===tab.id?`2px solid ${color}`:"2px solid transparent",marginBottom:-1,transition:"all 0.15s",display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap"}}>
              {tab.label}
              <span style={{fontSize:11,background:activeTab===tab.id?"var(--surface3)":"var(--surface2)",padding:"1px 7px",borderRadius:10,color:activeTab===tab.id?"var(--text2)":"var(--muted)"}}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* TASKS */}
        {activeTab==="tasks"&&(
          <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden"}}>

              {/* Mobile cards */}
              <div className="mobile-cards" style={{padding:8}}>
                {tasks.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--muted)",fontSize:13}}>No tasks yet. <button className="btn-primary" style={{marginLeft:8}} onClick={openAddTask}>+ Add one</button></div>}
                {tasks.map(task=>(
                  <div key={task.id} onClick={()=>setSelectedTask(task)} style={{background:"var(--surface2)",border:selectedTask?.id===task.id?`1.5px solid ${color}`:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",marginBottom:6,cursor:"pointer",transition:"all 0.15s"}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:8}}>{task.title}</div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}><StatusBadge status={task.status}/><PriBadge priority={task.priority}/></div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:11,background:"var(--surface)",border:"1px solid var(--border)",padding:"2px 8px",borderRadius:20,color:"var(--text2)",fontWeight:500}}>{task.assignee}</span>
                        {task.due&&<span style={{fontSize:11,color:"var(--muted)"}}>{task.due}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="table-desktop">
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
                    <thead>
                      <tr>
                        <th style={{...thStyle(""),width:36,textAlign:"center"}}>#</th>
                        <th style={thStyle("title")} onClick={()=>toggleSort("title")}>Task{sortIcon("title")}</th>
                        <th style={thStyle("assignee")} onClick={()=>toggleSort("assignee")}>Assignee{sortIcon("assignee")}</th>
                        <th style={thStyle("priority")} onClick={()=>toggleSort("priority")}>Priority{sortIcon("priority")}</th>
                        <th style={thStyle("status")} onClick={()=>toggleSort("status")}>Status{sortIcon("status")}</th>
                        <th style={thStyle("due")} onClick={()=>toggleSort("due")}>Due{sortIcon("due")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.length===0&&<tr><td colSpan={6} style={{padding:"48px",textAlign:"center",color:"var(--muted)",fontSize:13}}>No tasks yet. <button className="btn-primary" style={{marginLeft:10}} onClick={openAddTask}>+ Add one</button></td></tr>}
                      {tasks.map((task,i)=>{
                        const isSelected=selectedTask?.id===task.id;
                        const isOverdue=task.due&&new Date(task.due)<new Date()&&task.status!=="Done";
                        return(
                          <tr key={task.id} onClick={()=>setSelectedTask(isSelected?null:task)}
                            style={{borderTop:"1px solid var(--border)",cursor:"pointer",transition:"background 0.1s",background:isSelected?"rgba(201,125,42,0.06)":"transparent",borderLeft:isSelected?`3px solid ${color}`:"3px solid transparent"}}
                            onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background="var(--surface2)";}}
                            onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.background="transparent";}}>
                            <td style={{padding:"12px 14px",textAlign:"center",fontSize:11,color:"var(--muted)",fontWeight:500}}>{i+1}</td>
                            <td style={{padding:"12px 14px",maxWidth:260}}>
                              <div style={{fontSize:13,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</div>
                              {task.notes&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.notes}</div>}
                            </td>
                            <td style={{padding:"12px 14px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{width:20,height:20,borderRadius:"50%",background:task.assignee==="Rakesh"?"rgba(37,99,168,0.15)":"rgba(45,122,74,0.15)",color:task.assignee==="Rakesh"?"#2563a8":"#2d7a4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,flexShrink:0}}>{task.assignee[0]}</div>
                                <span style={{fontSize:12,fontWeight:500}}>{task.assignee}</span>
                              </div>
                            </td>
                            <td style={{padding:"12px 14px"}}><PriBadge priority={task.priority}/></td>
                            <td style={{padding:"12px 14px"}}><StatusBadge status={task.status}/></td>
                            <td style={{padding:"12px 14px",fontSize:12,color:isOverdue?"var(--red)":"var(--muted)",fontWeight:isOverdue?700:400}}>{task.due||"—"}{isOverdue&&" ⚠"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {tasks.length>0&&(
                      <tfoot>
                        <tr style={{borderTop:"2px solid var(--border2)",background:"var(--surface2)"}}>
                          <td colSpan={2} style={{padding:"10px 14px",fontSize:11,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{tasks.length} task{tasks.length!==1?"s":""}</td>
                          <td colSpan={4} style={{padding:"10px 14px",textAlign:"right",fontSize:11,color:"var(--muted)"}}>
                            {tasks.filter(t=>t.status==="Done").length} done · {tasks.filter(t=>t.status==="In Progress").length} in progress · {tasks.filter(t=>t.status==="Blocked").length} blocked
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            {/* Side panel — desktop only */}
            {selectedTask&&!isMobile&&(
              <div style={{width:300,flexShrink:0,background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:14,overflow:"hidden",position:"sticky",top:72,maxHeight:"calc(100vh - 100px)",display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,0.08)",animation:"slideInRight 0.18s ease"}}>
                <TaskDetail task={selectedTask} onClose={()=>setSelectedTask(null)}/>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS */}
        {activeTab==="payments"&&(
          <div>
            <div className="finance-cards" style={{marginBottom:24}}>
              <div className="finance-card"><div className="fc-label">Total Billed</div><div className="fc-value" style={{color:"var(--blue)"}}>{fmt(totalDue)}</div></div>
              <div className="finance-card"><div className="fc-label">Total Received</div><div className="fc-value" style={{color:"var(--green)"}}>{fmt(totalReceived)}</div></div>
              <div className="finance-card"><div className="fc-label">Outstanding</div><div className="fc-value" style={{color:totalPending>0?"var(--red)":"var(--green)"}}>{fmt(Math.abs(totalPending))}<span style={{fontSize:12,fontWeight:500,marginLeft:6,opacity:0.7}}>{totalPending>0?"due":totalPending<0?"excess":"✓ clear"}</span></div></div>
            </div>
            {payments.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:"var(--muted)",fontSize:13,lineHeight:2}}>No payments logged yet.<br/><button className="btn-primary" style={{marginTop:14}} onClick={openAddPay}>+ Log first payment</button></div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {payments.map(p=>{
                const st=payStatus(p),due=Number(p.amount_due)||0,rec=Number(p.amount_received)||0,bal=due-rec;
                return(
                  <div key={p.id} onClick={()=>openEditPay(p)} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"border-color 0.15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border2)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,letterSpacing:"-0.2px"}}>{p.month} {p.year}</div>
                        {p.notes&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{p.notes}</div>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:6,background:st.bg,color:st.color}}>{st.label}</span>
                        <button className="btn-danger" onClick={e=>{e.stopPropagation();deletePay(p.id);}} style={{padding:"4px 8px",fontSize:12}}>✕</button>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                      {[["Billed",fmt(due),"var(--blue)"],["Received",fmt(rec),"var(--green)"],["Balance",fmt(Math.abs(bal)),bal>0?"var(--red)":"var(--green)"]].map(([label,val,col])=>(
                        <div key={label} style={{background:"var(--surface2)",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,marginBottom:3}}>{label}</div>
                          <div style={{fontSize:13,fontWeight:700,color:col}}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NOTES */}
        {activeTab==="notes"&&(
          <div>
            {notes.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:"var(--muted)",fontSize:13,lineHeight:2}}>No notes yet.<br/><button className="btn-primary" style={{marginTop:14}} onClick={()=>setNoteModal(true)}>+ Add first note</button></div>}
            {notes.map(note=>(
              <div className="note-card" key={note.id}>
                <div className="note-meta">
                  <span className="note-author">{note.author}</span>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span className="note-date">{new Date(note.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                    <button className="note-delete" onClick={()=>deleteNote(note.id)}>✕</button>
                  </div>
                </div>
                <div className="note-text">{note.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile task detail modal */}
      {selectedTask&&isMobile&&(
        <div className="modal-backdrop" onClick={()=>setSelectedTask(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{padding:0,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <TaskDetail task={selectedTask} onClose={()=>setSelectedTask(null)}/>
          </div>
        </div>
      )}

      {/* Task add/edit modal */}
      {taskModal&&(
        <div className="modal-backdrop" onClick={()=>setTaskModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{taskModal.mode==="add"?"New Task":"Edit Task"}</div>
            <div className="field"><label>Title *</label><input value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))} placeholder="What needs to be done?" autoFocus/></div>
            <div className="field-row">
              <div className="field"><label>Assignee</label><select value={taskForm.assignee} onChange={e=>setTaskForm(f=>({...f,assignee:e.target.value}))}>{USERS.map(u=><option key={u}>{u}</option>)}</select></div>
              <div className="field"><label>Status</label><select value={taskForm.status} onChange={e=>setTaskForm(f=>({...f,status:e.target.value}))}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Priority</label><select value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))}>{["High","Medium","Low"].map(p=><option key={p}>{p}</option>)}</select></div>
              <div className="field"><label>Due Date</label><input type="date" value={taskForm.due} onChange={e=>setTaskForm(f=>({...f,due:e.target.value}))}/></div>
            </div>
            <div className="field"><label>Reference URL (optional)</label><input type="url" value={taskForm.url} onChange={e=>setTaskForm(f=>({...f,url:e.target.value}))} placeholder="https://…"/></div>
            <div className="field"><label>Notes</label><textarea value={taskForm.notes} onChange={e=>setTaskForm(f=>({...f,notes:e.target.value}))} placeholder="Any details…"/></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveTask} disabled={saving}>{saving?"Saving…":taskModal.mode==="add"?"Add Task":"Save"}</button>
              <button className="btn-ghost" onClick={()=>setTaskModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payModal&&(
        <div className="modal-backdrop" onClick={()=>setPayModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{payModal.mode==="add"?"Log Payment":"Edit Payment"}</div>
            <div className="field-row">
              <div className="field"><label>Month</label><select value={payForm.month} onChange={e=>setPayForm(f=>({...f,month:e.target.value}))}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div className="field"><label>Year</label><select value={payForm.year} onChange={e=>setPayForm(f=>({...f,year:e.target.value}))}>{YEARS.map(y=><option key={y}>{y}</option>)}</select></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Amount Due (₹)</label><input type="number" value={payForm.amount_due} onChange={e=>setPayForm(f=>({...f,amount_due:e.target.value}))} placeholder="0"/></div>
              <div className="field"><label>Amount Received (₹)</label><input type="number" value={payForm.amount_received} onChange={e=>setPayForm(f=>({...f,amount_received:e.target.value}))} placeholder="0"/></div>
            </div>
            {(payForm.amount_due||payForm.amount_received)&&(
              <div style={{padding:"11px 14px",background:"var(--surface2)",borderRadius:10,marginBottom:14,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:"var(--muted)"}}>Balance</span>
                <span style={{fontSize:13,fontWeight:700,color:(Number(payForm.amount_due)||0)>(Number(payForm.amount_received)||0)?"var(--red)":"var(--green)"}}>
                  {fmt(Math.abs((Number(payForm.amount_due)||0)-(Number(payForm.amount_received)||0)))} {(Number(payForm.amount_due)||0)>(Number(payForm.amount_received)||0)?"pending":"excess"}
                </span>
              </div>
            )}
            <div className="field"><label>Notes (optional)</label><textarea value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Invoice #12…" style={{minHeight:60}}/></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={savePay} disabled={saving}>{saving?"Saving…":payModal.mode==="add"?"Log Payment":"Save"}</button>
              <button className="btn-ghost" onClick={()=>setPayModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Note modal */}
      {noteModal&&(
        <div className="modal-backdrop" onClick={()=>setNoteModal(false)}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Add Note / Meeting Log</div>
            <div className="field"><label>Added by</label><select value={noteForm.author} onChange={e=>setNoteForm(f=>({...f,author:e.target.value}))}>{USERS.map(u=><option key={u}>{u}</option>)}</select></div>
            <div className="field"><label>Note</label><textarea value={noteForm.text} onChange={e=>setNoteForm(f=>({...f,text:e.target.value}))} placeholder="Meeting summary, decision, follow-up…" style={{minHeight:110}}/></div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveNote} disabled={saving}>{saving?"Saving…":"Save Note"}</button>
              <button className="btn-ghost" onClick={()=>setNoteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </>
  );
}
