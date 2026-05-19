"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Building2, FolderOpen, CheckSquare, X,
  ArrowRight, Loader2, Command, Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

type ResultType = "client" | "project" | "task" | "deliverable";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  type: ResultType;
}

const TYPE_META: Record<ResultType, { icon: React.ElementType; color: string; label: string }> = {
  client:      { icon: Building2,   color: "text-indigo-400",  label: "Clients" },
  project:     { icon: FolderOpen,  color: "text-violet-400",  label: "Projects" },
  task:        { icon: CheckSquare, color: "text-cyan-400",    label: "Tasks" },
  deliverable: { icon: Package,     color: "text-amber-400",   label: "Deliverables" },
};

interface Props {
  /** portal mode: only searches projects + deliverables visible to the current client */
  portalMode?: boolean;
}

export default function CommandPalette({ portalMode = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  /* ── keyboard shortcut ─── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  /* ── focus + reset on open ─── */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  /* ── search ─── */
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    setLoading(true);

    const pat = `%${trimmed}%`;

    if (portalMode) {
      const [projectsRes, deliverablesRes] = await Promise.all([
        supabase.from("projects").select("id, name, clients(company_name)").ilike("name", pat).limit(5),
        supabase.from("deliverables").select("id, title, project_id, projects(name)").ilike("title", pat).limit(5),
      ]);

      setResults([
        ...(projectsRes.data ?? []).map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: (p.clients as unknown as { company_name: string })?.company_name,
          type: "project" as const,
          href: `/portal/projects/${p.id}`,
        })),
        ...(deliverablesRes.data ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: (d.projects as unknown as { name: string })?.name,
          type: "deliverable" as const,
          href: `/portal/projects/${d.project_id}`,
        })),
      ]);
    } else {
      const [clientsRes, projectsRes, tasksRes, deliverablesRes] = await Promise.all([
        supabase.from("clients").select("id, company_name").ilike("company_name", pat).limit(4),
        supabase.from("projects").select("id, name, clients(company_name)").ilike("name", pat).limit(4),
        supabase.from("tasks").select("id, title, project_id").ilike("title", pat).limit(4),
        supabase.from("deliverables").select("id, title, project_id, projects(name)").ilike("title", pat).limit(4),
      ]);

      setResults([
        ...(clientsRes.data ?? []).map((c) => ({
          id: c.id,
          title: c.company_name,
          type: "client" as const,
          href: `/admin/clients/${c.id}`,
        })),
        ...(projectsRes.data ?? []).map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: (p.clients as unknown as { company_name: string })?.company_name,
          type: "project" as const,
          href: `/admin/projects/${p.id}`,
        })),
        ...(tasksRes.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          type: "task" as const,
          href: `/admin/projects/${t.project_id}/tasks`,
        })),
        ...(deliverablesRes.data ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          subtitle: (d.projects as unknown as { name: string })?.name,
          type: "deliverable" as const,
          href: `/admin/projects/${d.project_id}/deliverables`,
        })),
      ]);
    }

    setSelected(0);
    setLoading(false);
  }, [supabase, portalMode]);

  /* ── debounce ─── */
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 220);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  /* ── keyboard navigation in results ─── */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected].href);
  }

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  /* ── group by type ─── */
  const TYPES: ResultType[] = portalMode
    ? ["project", "deliverable"]
    : ["client", "project", "task", "deliverable"];

  const grouped = TYPES.reduce<Record<ResultType, SearchResult[]>>((acc, t) => {
    acc[t] = results.filter((r) => r.type === t);
    return acc;
  }, {} as Record<ResultType, SearchResult[]>);

  const hasResults = results.length > 0;
  const isEmpty = query.length >= 2 && !loading && !hasResults;

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-8 px-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white/40 hover:text-white/80 hover:bg-white/[0.09] hover:border-white/[0.16] transition-all duration-150 group"
        title="Search (⌘K)"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="hidden sm:inline text-xs whitespace-nowrap">Search…</span>
        <span className="hidden md:inline text-[10px] text-white/20 border border-white/[0.08] rounded-md px-1 py-0.5 font-mono group-hover:text-white/40 group-hover:border-white/[0.14] transition-all">
          ⌘K
        </span>
      </button>

      {/* ── Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cp-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md"
              onClick={() => setOpen(false)}
            />

            {/* Palette card */}
            <motion.div
              key="cp-panel"
              initial={{ opacity: 0, scale: 0.97, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-[8%] sm:top-[12%] left-1/2 -translate-x-1/2 z-[61] w-full max-w-xl px-4"
            >
              <div className="rounded-2xl bg-[#0d0d15]/96 backdrop-blur-2xl border border-white/[0.12] shadow-2xl shadow-black/70 overflow-hidden">

                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
                  {loading
                    ? <Loader2 className="h-4 w-4 text-indigo-400 animate-spin flex-shrink-0" />
                    : <Search className="h-4 w-4 text-white/35 flex-shrink-0" />
                  }
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={portalMode ? "Search projects, deliverables…" : "Search clients, projects, tasks, deliverables…"}
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none min-w-0"
                  />
                  {query && (
                    <button
                      onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                      className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0 pl-1 border-l border-white/[0.08]"
                  >
                    <kbd className="text-[10px] font-mono px-1">esc</kbd>
                  </button>
                </div>

                {/* Body */}
                <div className="max-h-[340px] sm:max-h-[420px] overflow-y-auto">

                  {/* Empty state — no query */}
                  {query.length < 2 && !loading && (
                    <div className="py-10 text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                        <Command className="h-5 w-5 text-white/20" />
                      </div>
                      <p className="text-sm text-white/40 font-medium">Quick search</p>
                      <p className="text-xs text-white/25 mt-1">Type at least 2 characters to search</p>
                      <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-white/20">
                        <span className="flex items-center gap-1"><kbd className="border border-white/[0.1] rounded px-1 py-0.5">⌘K</kbd> to open</span>
                        <span className="flex items-center gap-1"><kbd className="border border-white/[0.1] rounded px-1 py-0.5">↑↓</kbd> navigate</span>
                        <span className="flex items-center gap-1"><kbd className="border border-white/[0.1] rounded px-1 py-0.5">↵</kbd> open</span>
                      </div>
                    </div>
                  )}

                  {/* No results */}
                  {isEmpty && (
                    <div className="py-10 text-center">
                      <Search className="h-8 w-8 text-white/10 mx-auto mb-2" />
                      <p className="text-sm text-white/40">No results for <span className="text-white/60 font-medium">&ldquo;{query}&rdquo;</span></p>
                      <p className="text-xs text-white/25 mt-1">Try a different search term</p>
                    </div>
                  )}

                  {/* Results grouped by type */}
                  {hasResults && (
                    <div className="p-2 space-y-1">
                      {TYPES.map((type) => {
                        const items = grouped[type];
                        if (!items.length) return null;
                        const { icon: Icon, color, label } = TYPE_META[type];
                        return (
                          <div key={type}>
                            {/* Group label */}
                            <div className="flex items-center gap-2 px-3 py-1.5">
                              <Icon className={`h-3 w-3 ${color}`} />
                              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                                {label}
                              </span>
                              <span className="text-[10px] text-white/20 bg-white/[0.05] px-1.5 py-0.5 rounded-full">
                                {items.length}
                              </span>
                            </div>

                            {/* Items */}
                            {items.map((result) => {
                              const globalIdx = results.indexOf(result);
                              const isSelected = globalIdx === selected;
                              const { icon: ItemIcon, color: itemColor } = TYPE_META[result.type];
                              return (
                                <button
                                  key={result.id}
                                  onClick={() => navigate(result.href)}
                                  onMouseEnter={() => setSelected(globalIdx)}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-100 ${
                                    isSelected
                                      ? "bg-white/[0.08] ring-1 ring-white/[0.1]"
                                      : "hover:bg-white/[0.05]"
                                  }`}
                                >
                                  <div className={`w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 ${itemColor}`}>
                                    <ItemIcon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-medium truncate transition-colors ${
                                      isSelected ? "text-white" : "text-white/75"
                                    }`}>
                                      {result.title}
                                    </p>
                                    {result.subtitle && (
                                      <p className="text-xs text-white/35 truncate mt-0.5">{result.subtitle}</p>
                                    )}
                                  </div>
                                  <ArrowRight className={`h-3.5 w-3.5 flex-shrink-0 transition-all ${
                                    isSelected ? "text-white/50 translate-x-0.5" : "text-transparent"
                                  }`} />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {hasResults && (
                  <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-4 text-[11px] text-white/20">
                    <span className="flex items-center gap-1.5">
                      <kbd className="border border-white/[0.1] rounded px-1 py-0.5">↑↓</kbd>
                      navigate
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="border border-white/[0.1] rounded px-1 py-0.5">↵</kbd>
                      open
                    </span>
                    <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
