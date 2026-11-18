// Graphic Design tasks: Basic or Premium. Their dates are set by the database
// (0028 graphics_task_dates) the day the task first reaches Consultation, so
// the forms only pick the type. Shared by web and mobile.

export const GRAPHICS_SLUG = "graphics";

export type Tier = "basic" | "premium";

export const TIERS: { value: Tier; label: string; days: number }[] = [
  { value: "basic", label: "Basic", days: 20 },
  { value: "premium", label: "Premium", days: 25 },
];

export const tierLabel = (tier: string | null | undefined) => TIERS.find((t) => t.value === tier)?.label ?? null;

export function tierHint(tier: string | null | undefined): string {
  const t = TIERS.find((x) => x.value === tier);
  const span = t ? `${t.days} business days` : "20 (Basic) or 25 (Premium) business days";
  return `Dates start when the task moves to Consultation: due ${span} later, counting that day, Sunday to Thursday.`;
}

// Branding (0033) has no staff of its own: graphic designers do Branding
// projects. They're the project's people instead of creatives, and they take
// its tasks.
export const BRANDING_SLUG = "branding";

/** The department whose people take a department's tasks. */
export const staffSlug = (slug: string) => (slug === BRANDING_SLUG ? GRAPHICS_SLUG : slug);

export type Person = { profile_id: string; full_name: string; slugs: string[] };

type Db = { from(table: string): any };
const first = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null;

/** Every creative and graphic designer, with their department slugs. */
export async function fetchPeople(db: Db): Promise<Person[]> {
  const { data, error } = await db
    .from("employees")
    .select("profile_id, profiles(full_name), employee_departments!inner(departments!inner(slug))")
    .in("employee_departments.departments.slug", ["creatives", GRAPHICS_SLUG]);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    profile_id: row.profile_id as string,
    full_name: first(row.profiles)?.full_name ?? "Unknown",
    slugs: (row.employee_departments ?? []).map((d: any) => first(d.departments)?.slug as string),
  }));
}

/**
 * Who can go on a project as its people (project_creatives), given the
 * project's department slugs: graphic designers on Branding, creatives on
 * everything else, both when a project mixes the two.
 */
export function projectPeople<T extends { slugs: string[] }>(people: T[], deptSlugs: string[]) {
  const branding = deptSlugs.includes(BRANDING_SLUG);
  const other = deptSlugs.length === 0 || deptSlugs.some((s) => s !== BRANDING_SLUG);
  const want = [...(other ? ["creatives"] : []), ...(branding ? [GRAPHICS_SLUG] : [])];
  return {
    label: !other ? "Graphic designers" : branding ? "Creatives & designers" : "Creatives",
    people: people.filter((p) => p.slugs.some((s) => want.includes(s))),
  };
}
