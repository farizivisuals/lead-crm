"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  employees: { id: string; name: string }[];
  selected: string; // "" = all, "me" = mine, otherwise a profile id
}

export default function EmployeeFilter({ employees, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mine");
    params.delete("emp");
    if (value === "me") params.set("mine", "1");
    else if (value !== "all") params.set("emp", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={selected} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-44 rounded-xl text-xs bg-white/[0.05] border-white/[0.09]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Tasks</SelectItem>
        <SelectItem value="me">My Tasks</SelectItem>
        {employees.map((e) => (
          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
