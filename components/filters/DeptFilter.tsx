"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Department { id: string; name: string; }

interface Props {
  departments: Department[];
  currentDeptId?: string;
}

export default function DeptFilter({ departments, currentDeptId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(deptId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (deptId) params.set("dept_id", deptId);
    else params.delete("dept_id");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const current = departments.find((d) => d.id === currentDeptId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-8 px-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-xs font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-150"
      >
        <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
        <span>{current?.name ?? "All Departments"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1.5 w-52 z-50 rounded-xl bg-[#0e0e16]/98 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/50 overflow-hidden py-1"
          >
            <button
              onClick={() => select(null)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                !currentDeptId ? "text-white bg-white/[0.07]" : "text-white/60 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <span>All Departments</span>
              {!currentDeptId && <Check className="h-3.5 w-3.5 text-zinc-300" />}
            </button>
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() => select(dept.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  currentDeptId === dept.id
                    ? "text-white bg-white/[0.07]"
                    : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                <span>{dept.name}</span>
                {currentDeptId === dept.id && <Check className="h-3.5 w-3.5 text-zinc-300" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
