import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import Dashboard from "./components/Dashboard";
import ProjectDetail from "./components/ProjectDetail";
import "./App.css";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchTimer = useRef(null);

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel("realtime-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, debouncedFetch)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const debouncedFetch = () => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => fetchProjects(), 400);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select(`*, tasks(*), notes(*), payments(*)`)
      .order("created_at", { ascending: true });

    if (data) {
      // Deduplicate by id just in case
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
          />
        : <Dashboard
            projects={projects}
            onSelectProject={setActiveProject}
            onRefresh={fetchProjects}
          />
      }
    </div>
  );
}
