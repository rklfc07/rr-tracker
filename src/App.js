import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import Dashboard from "./components/Dashboard";
import ProjectDetail from "./components/ProjectDetail";
import Login from "./components/Login";
import "./App.css";

export default function App() {
  const [authed, setAuthed]             = useState(() => localStorage.getItem("rr_auth") === "true");
  const [projects, setProjects]         = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading]           = useState(true);
  const fetchTimer = useRef(null);

  useEffect(() => {
    if (!authed) return;

    fetchProjects();

    const debounced = () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => fetchProjects(), 400);
    };

    const channel = supabase
      .channel("realtime-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, debounced)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [authed]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select(`*, tasks(*), notes(*), payments(*)`)
      .order("created_at", { ascending: true });

    if (data) {
      const seen = new Set();
      const unique = data.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setProjects(unique);
    }
    setLoading(false);
  };

  const handleLogin  = () => setAuthed(true);
  const handleLogout = () => {
    localStorage.removeItem("rr_auth");
    setAuthed(false);
    setProjects([]);
    setActiveProject(null);
    setLoading(true);
  };

  if (!authed) return <Login onLogin={handleLogin} />;

  if (loading) return (
    <div className="loader-wrap">
      <div className="loader-dot" />
      <span>Loading your workspace…</span>
    </div>
  );

  return (
    <div className="app">
      {activeProject
        ? <ProjectDetail
            project={projects.find(p => p.id === activeProject)}
            onBack={() => setActiveProject(null)}
            onRefresh={fetchProjects}
            onLogout={handleLogout}
          />
        : <Dashboard
            projects={projects}
            onSelectProject={setActiveProject}
            onRefresh={fetchProjects}
            onLogout={handleLogout}
          />
      }
    </div>
  );
}
