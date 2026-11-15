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
