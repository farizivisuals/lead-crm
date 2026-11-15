import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Delivers one notification to every device its recipient has registered.
 *
 * Called by the database (migration 0029, push_notification trigger) with
 * just `{ notification_id }` and the public anon key. The function loads the
 * row itself and claims it by setting `pushed_at`, so a caller can neither
 * push arbitrary text nor push the same notification twice.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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

  // Claim it: only the first call for a pushable, unpushed row gets it back.
  const { data: n, error } = await supabase
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("push", true)
    .is("pushed_at", null)
    .select("recipient_profile_id, title, body, entity_type, entity_id")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!n) return json({ skipped: true, reason: "already pushed or not pushable" });

  const { data: tokens, error: tokErr } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("profile_id", n.recipient_profile_id);
  if (tokErr) return json({ error: tokErr.message }, 500);
  if (!tokens?.length) return json({ sent: 0, reason: "no devices" });

  // A task notification carries its project so the app can open the task itself.
  let projectId: string | null = null;
  if (n.entity_type === "task" && n.entity_id) {
    const { data: t } = await supabase.from("tasks").select("project_id").eq("id", n.entity_id).maybeSingle();
    projectId = t?.project_id ?? null;
  }

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

  return json({ sent: messages.length, pruned: dead.length });
});
