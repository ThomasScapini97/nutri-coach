import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = user.id;

    // Delete all user data first
    const { data: logs } = await supabase.from("food_logs").select("id").eq("user_id", userId);
    if (logs?.length > 0) {
      const logIds = logs.map(l => l.id);
      await supabase.from("food_entries").delete().in("foodlog_id", logIds);
      await supabase.from("messages").delete().in("foodlog_id", logIds);
      await supabase.from("food_logs").delete().eq("user_id", userId);
    }
    await supabase.from("exercise_logs").delete().eq("user_id", userId);
    await supabase.from("diary_entries").delete().eq("user_id", userId);
    await supabase.from("rate_limits").delete().eq("user_id", userId);
    await supabase.from("user_profiles").delete().eq("user_id", userId);

    // Delete the auth user (requires service role key)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return res.status(500).json({ error: "Failed to delete auth user" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
