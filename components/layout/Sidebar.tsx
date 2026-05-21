"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FolderOpen, Calendar, Settings,
  Building2, LogOut, Layers, UserCircle, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Employee, Profile } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/rbac";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface SidebarProps {
  profile: Profile;
  employee: Employee;
}

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FolderOpen },
  { href: "/admin/calendar", label: "Calendar", icon: Calendar },
];

const SETTINGS_ITEMS = [
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/settings/departments", label: "Stages", icon: Layers },
  { href: "/admin/settings/profile", label: "Profile", icon: UserCircle },
];

function NavItem({ href, label, icon: Icon, active, onClick }: {
  href: string; label: string; icon: React.ElementType; active: boolean; onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className="relative block">
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/20 to-violet-500/10 border border-indigo-500/30"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
          active ? "text-white" : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
        )}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", active ? "text-indigo-400" : "text-current")} />
        {label}
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_2px_rgba(99,102,241,0.6)]" />
        )}
      </span>
    </Link>
  );
}

function SidebarContent({
  profile,
  employee,
  pathname,
  onNavClick,
  onSignOut,
}: {
  profile: Profile;
  employee: Employee;
  pathname: string;
  onNavClick?: () => void;
  onSignOut: () => void;
}) {
  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative flex flex-col h-full">
      <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-violet-600/15 blur-2xl pointer-events-none" />

      {/* Logo */}
      <div className="relative px-4 py-4 border-b border-white/[0.07] flex items-center">
        <div className="overflow-hidden flex-shrink-0" style={{ width: '82px', height: '38px' }}>
          <Image
            src="/logo.png"
            alt="lead."
            width={116}
            height={116}
            className="invert opacity-90"
            style={{ transform: 'translate(-18px, -36px)' }}
            priority
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
          return <NavItem key={href} href={href} label={label} icon={icon} active={active} onClick={onNavClick} />;
        })}

        <div className="pt-5 pb-1 px-3">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Settings</p>
        </div>

        {SETTINGS_ITEMS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return <NavItem key={href} href={href} label={label} icon={icon} active={active} onClick={onNavClick} />;
        })}
      </nav>

      {/* User */}
      <div className="relative border-t border-white/[0.07] px-3 py-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.05] transition-colors group">
          <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-white/10">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-indigo-500/30 text-indigo-300 font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90 truncate leading-tight">{profile.full_name}</p>
            <p className="text-[11px] text-white/40 truncate mt-0.5">{ROLE_LABELS[employee.role]}</p>
          </div>
          <button
            onClick={onSignOut}
            className="text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ profile, employee }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const commonProps = { profile, employee, pathname, onSignOut: handleSignOut };

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col z-40 overflow-hidden">
        <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-2xl border-r border-white/[0.07]" />
        <SidebarContent {...commonProps} />
      </aside>

      {/* ── Mobile hamburger button ──────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3.5 left-4 z-50 w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.1] text-white/70 flex items-center justify-center hover:bg-white/[0.12] active:scale-95 transition-all"
        aria-label="Open menu"
      >
        <Menu className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      </button>

      {/* ── Mobile backdrop ──────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile drawer ────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="lg:hidden fixed inset-y-0 left-0 w-[280px] z-50 flex flex-col overflow-hidden"
          >
            <div className="absolute inset-0 bg-[#0b0b12]/95 backdrop-blur-2xl border-r border-white/[0.1]" />
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-white/[0.07] border border-white/[0.1] text-white/50 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent {...commonProps} onNavClick={() => setMobileOpen(false)} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
