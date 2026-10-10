import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Supabase Auth Admin listUsers is paginated; gather every page for Central Control. */
async function listAllAuthUsers(admin: ReturnType<typeof createClient>) {
  const users: any[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { users: null, error };
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) return { users, error: null };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("Provisioning function is missing required Supabase environment variables.");
    return json(500, { error: "Server configuration is incomplete." });
  }

  const authorization = req.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return json(401, { error: "Authentication required." });

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(match[1]);
  if (callerError || !callerData.user) return json(401, { error: "Invalid or expired session." });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile, error: profileError } = await admin
    .from("profiles").select("platform_role").eq("user_id", callerData.user.id).maybeSingle();
  if (profileError) {
    console.error("Caller role lookup failed:", profileError.message);
    return json(500, { error: "Could not verify platform permissions." });
  }
  if (callerProfile?.platform_role !== "super_admin") {
    return json(403, { error: "Only an authorized Super Admin can perform this action." });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(400, { error: "Invalid request body." });
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const action = clean(body.action, 40);
  if (action === "list_admins") {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles").select("user_id,full_name,email,platform_role").eq("platform_role", "user");
    if (profilesError) {
      console.error("Admin profile list failed:", profilesError.message);
      return json(500, { error: "Could not load administrator accounts." });
    }
    const ids = (profiles || []).map((p: { user_id: string }) => p.user_id);
    if (!ids.length) return json(200, { users: [] });

    const [{ data: memberships, error: membersError }, authUsersResult] = await Promise.all([
      admin.from("workspace_members").select("user_id,workspace_id,role").in("user_id", ids).eq("role", "admin"),
      listAllAuthUsers(admin),
    ]);
    if (membersError || authUsersResult.error) {
      console.error("Admin account details lookup failed:", membersError?.message, authUsersResult.error?.message);
      return json(500, { error: "Could not load administrator account details." });
    }
    const authUsers = authUsersResult.users || [];
    const workspaceIds = [...new Set((memberships || []).map((m: { workspace_id: string }) => m.workspace_id))];
    const { data: workspaces, error: workspaceError } = workspaceIds.length
      ? await admin.from("workspaces").select("id,name,status").in("id", workspaceIds)
      : { data: [], error: null };
    if (workspaceError) {
      console.error("Workspace lookup failed:", workspaceError.message);
      return json(500, { error: "Could not load administrator workspaces." });
    }
    const authById = new Map(authUsers.map((u: any) => [u.id, u]));
    const workspaceById = new Map((workspaces || []).map((w: any) => [w.id, w]));
    const membershipByUser = new Map<string, any[]>();
    for (const m of memberships || []) {
      const list = membershipByUser.get(m.user_id) || [];
      const w = workspaceById.get(m.workspace_id);
      if (w) list.push({ id: w.id, name: w.name, status: w.status });
      membershipByUser.set(m.user_id, list);
    }
    const users = (profiles || []).filter((p: any) => membershipByUser.has(p.user_id)).map((p: any) => {
      const authUser: any = authById.get(p.user_id);
      const banned = !!authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now();
      return {
        id: p.user_id,
        name: p.full_name || "Administrator",
        email: p.email || "",
        role: "admin",
        status: banned ? "Suspended" : authUser?.email_confirmed_at ? "Active" : "Invited",
        createdAt: authUser?.created_at || null,
        workspaces: membershipByUser.get(p.user_id) || [],
      };
    });
    return json(200, { users });
  }

  // Super-admin invitations are deliberately not supported by this endpoint.
  // Admin invitations retain existing behavior; invite_member is restricted to approved non-Admin roles.
  if (action !== "invite_admin" && action !== "invite_member") return json(400, { error: "Unsupported action." });

  const fullName = clean(body.full_name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const workspaceName = clean(body.workspace_name, 160);
  const requestedRole = clean(body.role, 40);
  const allowedMemberRoles = ["advocate", "junior_advocate", "clerk", "accountant", "staff"];
  const workspaceRole = action === "invite_member" ? requestedRole : "admin";
  if (action === "invite_member" && !allowedMemberRoles.includes(workspaceRole)) {
    return json(400, { error: "Choose an approved non-Admin workspace role." });
  }
  if (!fullName || !workspaceName || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return json(400, { error: "A valid email, full name, and workspace name are required." });
  }

  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (inviteError || !invitation.user) {
    const message = inviteError?.message || "Invitation could not be created.";
    const duplicate = /already|registered|exists/i.test(message);
    return json(duplicate ? 409 : 400, { error: duplicate ? "This email is already registered. Check the account list before retrying." : "Could not send the administrator invitation." });
  }

  const userId = invitation.user.id;
  let workspaceId: string | null = null;
  let profileCreated = false;
  let membershipCreated = false;
  try {
    const { error: insertProfileError } = await admin.from("profiles").insert({
      user_id: userId, full_name: fullName, email, platform_role: "user",
    });
    if (insertProfileError) throw new Error("Profile creation failed: " + insertProfileError.message);
    profileCreated = true;

    const { data: workspace, error: workspaceInsertError } = await admin.from("workspaces")
      .insert({ name: workspaceName, owner_id: userId, status: "active" }).select("id").single();
    if (workspaceInsertError || !workspace) throw new Error("Workspace creation failed: " + (workspaceInsertError?.message || "No workspace returned."));
    workspaceId = workspace.id;

    const { error: memberInsertError } = await admin.from("workspace_members").insert({
      workspace_id: workspaceId, user_id: userId, role: workspaceRole,
    });
    if (memberInsertError) throw new Error("Workspace membership creation failed: " + memberInsertError.message);
    membershipCreated = true;
  } catch (provisionError) {
    console.error("Admin provisioning failed; attempting compensating cleanup:", provisionError);
    if (membershipCreated && workspaceId) await admin.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    if (workspaceId) await admin.from("workspaces").delete().eq("id", workspaceId);
    if (profileCreated) await admin.from("profiles").delete().eq("user_id", userId);
    const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);
    if (cleanupError) console.error("Compensating Auth cleanup failed:", cleanupError.message);
    return json(500, { error: "Administrator setup did not complete. Cleanup was attempted; verify the test account list before retrying." });
  }

  return json(200, { success: true, invited: true, role: workspaceRole, user_id: userId });
});
