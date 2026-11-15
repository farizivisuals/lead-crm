import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Delivers one notification: a phone push to every device the recipient has
 * registered, plus an email when a task is assigned to them.
 *
 * Called by the database (migration 0029, push_notification trigger) with
 * just `{ notification_id }` and the public anon key. The function loads the
 * row itself and claims it by setting `pushed_at`, so a caller can neither
 * send arbitrary text nor send the same notification twice.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const RESEND_URL = "https://api.resend.com/emails";
const EMAIL_FROM = "Lead CRM <notifications@madebylead.co>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://lead-crm-farizivisuals-projects.vercel.app";
/** Notification types that also go out by email. */
const EMAIL_TYPES = new Set(["task_assigned"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Task = {
  title: string;
  project_id: string;
  start_date: string | null;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  projects: { name: string } | null;
};

function when(t: Task): string | null {
  const d = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const days = t.start_date && t.due_date && t.start_date !== t.due_date
    ? `${d(t.start_date)} – ${d(t.due_date)}`
    : t.start_date || t.due_date ? d((t.start_date || t.due_date)!) : null;
  if (!days) return null;
  return t.start_time && t.end_time ? `${days}, ${t.start_time.slice(0, 5)}–${t.end_time.slice(0, 5)}` : days;
}

function locationHref(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+\//.test(s)) return `https://${s}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`;
}

function emailHtml(name: string, body: string, task: Task | null, link: string): string {
  const rows: string[] = [];
  if (task?.projects?.name) rows.push(`<tr><td style="color:#71717a;padding:4px 16px 4px 0">Project</td><td>${esc(task.projects.name)}</td></tr>`);
  const w = task && when(task);
  if (w) rows.push(`<tr><td style="color:#71717a;padding:4px 16px 4px 0">When</td><td>${esc(w)}</td></tr>`);
  if (task?.location) {
    rows.push(`<tr><td style="color:#71717a;padding:4px 16px 4px 0">Location</td><td><a href="${esc(locationHref(task.location))}" style="color:#0284c7">Open map</a></td></tr>`);
  }
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:16px;padding:28px">
      <p style="margin:0 0 8px;font-size:15px">Hi ${esc(name)},</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">${esc(body)}</p>
      ${rows.length ? `<table style="font-size:14px;margin:0 0 24px;border-collapse:collapse">${rows.join("")}</table>` : ""}
      <a href="${esc(link)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px">Open task</a>
    </div>
    <p style="font-size:12px;color:#a1a1aa;text-align:center;margin:16px 0 0">Lead CRM · You're getting this because a task was assigned to you.</p>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let notificationId: string | undefined;
  try {
    notificationId = (await req.json())?.notification_id;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!notificationId) return json({ skipped: true, reason: "no notification_id" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Claim it: only the first call for a pushable, unsent row gets it back.
  const { data: n, error } = await supabase
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("push", true)
    .is("pushed_at", null)
    .select("recipient_profile_id, type, title, body, entity_type, entity_id")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!n) return json({ skipped: true, reason: "already sent or not pushable" });

  let task: Task | null = null;
  if (n.entity_type === "task" && n.entity_id) {
    const { data } = await supabase
      .from("tasks")
      .select("title, project_id, start_date, due_date, start_time, end_time, location, projects(name)")
      .eq("id", n.entity_id)
      .maybeSingle();
    task = (data as unknown as Task) ?? null;
  }
  const projectId = task?.project_id ?? null;

  // Email first: it shouldn't depend on the person having the app installed.
  let emailed: string | null = null;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey && EMAIL_TYPES.has(n.type)) {
    const { data: u } = await supabase.auth.admin.getUserById(n.recipient_profile_id);
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", n.recipient_profile_id).maybeSingle();
    const to = u?.user?.email;
    if (to) {
      const link = projectId ? `${APP_URL}/admin/projects/${projectId}/tasks#task-${n.entity_id}` : `${APP_URL}/admin/dashboard`;
      const name = (p?.full_name ?? "").trim().split(/\s+/)[0] || "there";
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to,
          subject: task ? `New task: ${task.title}` : n.title,
          html: emailHtml(name, n.body, task, link),
          text: `${n.body}\n\nOpen task: ${link}`,
        }),
      });
      emailed = res.ok ? "sent" : `failed ${res.status}: ${(await res.text()).slice(0, 200)}`;
    }
  }

  const { data: tokens, error: tokErr } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("profile_id", n.recipient_profile_id);
  if (tokErr) return json({ error: tokErr.message, emailed }, 500);
  if (!tokens?.length) return json({ sent: 0, reason: "no devices", emailed });

  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    sound: "default",
    title: n.title,
    body: n.body,
    data: { entity_type: n.entity_type, entity_id: n.entity_id, project_id: projectId },
  }));

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  const tickets: any[] = (await expoRes.json().catch(() => null))?.data ?? [];

  // A dead device is reported as DeviceNotRegistered; drop it so it isn't retried forever.
  const dead = tickets
    .map((ticket, i) => (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered" ? messages[i].to : null))
    .filter(Boolean);
  if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);

  return json({ sent: messages.length, pruned: dead.length, emailed });
});
