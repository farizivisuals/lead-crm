"use client";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { locationHref, locationLabel } from "@/lib/location";

/** Shoot location: paste a Google Maps / Waze link, or type an address. */
export function LocationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Location</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a Google Maps or Waze link, or type an address"
        maxLength={2000}
      />
      {value.trim() && <LocationLink location={value} />}
    </div>
  );
}

export function LocationLink({ location, className = "" }: { location: string; className?: string }) {
  const href = locationHref(location);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 hover:underline ${className}`}
    >
      <MapPin className="h-3 w-3 flex-shrink-0" />
      <span className="truncate max-w-[220px]">{locationLabel(location)}</span>
    </a>
  );
}
