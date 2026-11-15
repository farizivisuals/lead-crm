// Shoot location: whatever was pasted into the task — a Google Maps or Waze
// link, or just an address. Shared by web and mobile (@shared/location).

const isLink = (s: string) => /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+\//.test(s);

/** The URL to open, or null when there's no location. An address becomes a Google Maps search. */
export function locationHref(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (isLink(s)) return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`;
}

/** Button text: which app a link opens in, or the address itself. */
export function locationLabel(raw: string): string {
  const s = raw.trim();
  if (!isLink(s)) return s;
  if (/waze\.com/i.test(s)) return "Open in Waze";
  if (/goo\.gl|google\.[a-z.]+\/maps|maps\.google\./i.test(s)) return "Open in Google Maps";
  return "Open location";
}
