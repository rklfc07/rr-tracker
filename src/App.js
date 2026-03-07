import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Dashboard from "./components/Dashboard";
import ProjectDetail from "./components/ProjectDetail";
import "./App.css";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel("realtime-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchProjects)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchProjects)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, fetchProjects)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchProjects = async () => {
    const { data: projectsData } = await supabase
      .from("projects")
      .select(`*, tasks(*), notes(*)`)
      .order("created_at", { ascending: true });
    if (projectsData) setProjects(projectsData);
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
