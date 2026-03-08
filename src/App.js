import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import Dashboard from "./components/Dashboard";
import ProjectDetail from "./components/ProjectDetail";
import Login from "./components/Login";
import "./App.css";

// ── sessionStorage helpers (survive refresh) ──────────────────
function readNav() {
  try {
    const raw = sessionStorage.getItem("rr_nav");
    return raw ? JSON.parse(raw) : { activeProject: null, activeCategory: null, dashView: "categories" };
  } catch { return { activeProject: null, activeCategory: null, dashView: "categories" }; }
}
function writeNav(state) {
  try { sessionStorage.setItem("rr_nav", JSON.stringify(state)); } catch {}
}

// ── Read initial state from URL hash so refresh works ─────────
// URL scheme:
//   /                       → screen 1 (categories)
//   #category=Google+Ads    → screen 2 (projects list)
//   #project=<uuid>         → screen 3 (project detail)
function readHash() {
  const hash = window.location.hash.slice(1); // strip #
  const params = new URLSearchParams(hash);
  return {
    activeProject:  params.get("project")  || null,
    activeCategory: params.get("category") || null,
    dashView:       params.get("category") ? "projects" : "categories",
  };
}
function writeHash(state) {
  const params = new URLSearchParams();
  if (state.activeProject)  params.set("project",  state.activeProject);
  else if (state.activeCategory) params.set("category", state.activeCategory);
  const hash = params.toString();
  // Use pushState so browser back/forward works
  window.history.pushState(state, "", hash ? `#${hash}` : window.location.pathname);
}
function replaceHash(state) {
  const params = new URLSearchParams();
  if (state.activeProject)  params.set("project",  state.activeProject);
  else if (state.activeCategory) params.set("category", state.activeCategory);
  const hash = params.toString();
  window.history.replaceState(state, "", hash ? `#${hash}` : window.location.pathname);
}

export default function App() {
  const [authed,   setAuthed]   = useState(() => localStorage.getItem("rr_auth") === "true");
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const fetchTimer = useRef(null);

  // Boot from URL hash (handles refresh + direct links), fall back to sessionStorage
  const getInitial = () => {
    const fromHash = readHash();
    if (fromHash.activeProject || fromHash.activeCategory) return fromHash;
    return readNav();
  };
  const initial = getInitial();

  const [activeProject,  setActiveProjectRaw]  = useState(initial.activeProject);
  const [activeCategory, setActiveCategoryRaw] = useState(initial.activeCategory);
  const [dashView,       setDashViewRaw]        = useState(initial.dashView || "categories");

  // ── Sync state to both URL history and sessionStorage ────────
  const applyNav = (state, push = true) => {
    const { activeProject: ap, activeCategory: ac, dashView: dv } = state;
    setActiveProjectRaw(ap);
    setActiveCategoryRaw(ac);
    setDashViewRaw(dv);
    writeNav(state);
    if (push) writeHash(state);
    else replaceHash(state);
  };

  // ── Navigation helpers ────────────────────────────────────────
  const navToCategory   = (cat, view) => applyNav({ activeProject: null, activeCategory: cat,  dashView: view || (cat ? "projects" : "categories") });
  const navToProject  = (id)        => applyNav({ activeProject: id,   activeCategory, dashView });
  const backFromProject = ()          => applyNav({ activeProject: null, activeCategory, dashView });

  // ── Handle browser back/forward button ───────────────────────
  useEffect(() => {
    const onPop = (e) => {
      // e.state is the object we passed to pushState
      const state = e.state || readHash();
      setActiveProjectRaw(state.activeProject  || null);
      setActiveCategoryRaw(state.activeCategory || null);
      setDashViewRaw(state.activeCategory ? (state.dashView || "projects") : "categories");
      writeNav(state);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On first mount, write current state into history so the
  //    very first screen is also in the history stack ───────────
  useEffect(() => {
    replaceHash({ activeProject, activeCategory, dashView });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase data + realtime ──────────────────────────────────
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
    window.history.replaceState({}, "", window.location.pathname);
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
            onBack={backFromProject}
            onRefresh={fetchProjects}
            onLogout={handleLogout}
          />
        : <Dashboard
            projects={projects}
            onSelectProject={navToProject}
            onRefresh={fetchProjects}
            onLogout={handleLogout}
            initialView={dashView}
            initialCategory={activeCategory}
            onViewChange={navToCategory}
          />
      }
    </div>
  );
}
