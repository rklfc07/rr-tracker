import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import Dashboard from "./components/Dashboard";
import ProjectDetail from "./components/ProjectDetail";
import Login from "./components/Login";
import "./App.css";

// Persist nav state across refreshes using sessionStorage
function readNav() {
  try {
    const raw = sessionStorage.getItem("rr_nav");
    return raw ? JSON.parse(raw) : { activeProject: null, activeCategory: null, dashView: "categories" };
  } catch { return { activeProject: null, activeCategory: null, dashView: "categories" }; }
}
function writeNav(state) {
  try { sessionStorage.setItem("rr_nav", JSON.stringify(state)); } catch {}
}

export default function App() {
  const [authed,  setAuthed]  = useState(() => localStorage.getItem("rr_auth") === "true");
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const fetchTimer = useRef(null);

  // Navigation state — restored from sessionStorage on refresh
  const [activeProject,  setActiveProjectRaw]  = useState(() => readNav().activeProject);
  const [activeCategory, setActiveCategoryRaw] = useState(() => readNav().activeCategory);
  const [dashView,       setDashViewRaw]        = useState(() => readNav().dashView || "categories");

  // Combined setter used by Dashboard when changing category+view together
  const navToCategory = (cat, view) => {
    setActiveCategoryRaw(cat);
    setDashViewRaw(view);
    writeNav({ activeProject, activeCategory: cat, dashView: view });
  };
  const navToProject = (id) => {
    setActiveProjectRaw(id);
    writeNav({ activeProject: id, activeCategory, dashView });
  };
  // Back from project → return to category view (screen 2), not screen 1
  const backFromProject = () => {
    setActiveProjectRaw(null);
    // Keep activeCategory and dashView as-is so Dashboard restores screen 2
    writeNav({ activeProject: null, activeCategory, dashView });
  };

  useEffect(() => {
    if (!authed) return;
    fetchProjects();

    const debounced = () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => fetchProjects(), 400);
    };

    const channel = supabase
      .channel("realtime-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects"  }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks"     }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes"     }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments"  }, debounced)
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
      const unique = data.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setProjects(unique);
    }
    setLoading(false);
  };

  const handleLogin = () => setAuthed(true);
  const handleLogout = () => {
    localStorage.removeItem("rr_auth");
    sessionStorage.removeItem("rr_nav");
    setAuthed(false);
    setProjects([]);
    setActiveProjectRaw(null);
    setActiveCategoryRaw(null);
    setDashViewRaw("categories");
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
            onBack={backFromProject}           // ← goes to screen 2, not screen 1
            onRefresh={fetchProjects}
            onLogout={handleLogout}
          />
        : <Dashboard
            projects={projects}
            onSelectProject={navToProject}
            onRefresh={fetchProjects}
            onLogout={handleLogout}
            // Pass persisted nav state down so Dashboard restores correctly
            initialView={dashView}
            initialCategory={activeCategory}
            onViewChange={navToCategory}       // ← Dashboard calls this when switching views
          />
      }
    </div>
  );
}
