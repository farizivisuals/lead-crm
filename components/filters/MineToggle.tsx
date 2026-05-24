"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { User, Users } from "lucide-react";

interface Props {
  isMine: boolean;
}

export default function MineToggle({ isMine }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (isMine) params.delete("mine");
    else params.set("mine", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 h-8 px-3 rounded-xl border text-xs font-medium transition-all duration-150 ${
        isMine
          ? "bg-white/[0.1] border-white/[0.2] text-zinc-200 hover:bg-white/[0.14]"
          : "bg-white/[0.05] border-white/[0.09] text-white/50 hover:text-white/80 hover:bg-white/[0.08] hover:border-white/[0.15]"
      }`}
    >
      {isMine ? (
        <User className="h-3.5 w-3.5" />
      ) : (
        <Users className="h-3.5 w-3.5" />
      )}
      {isMine ? "My Tasks" : "All Tasks"}
    </button>
  );
}
