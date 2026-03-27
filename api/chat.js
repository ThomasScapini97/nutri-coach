import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_LIMIT = 50;

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
    // Verifica il token Supabase e ottieni l'utente
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Controlla e aggiorna il rate limit
    const { data: rateData } = await supabase
      .from("rate_limits")
      .select("message_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    const currentCount = rateData?.message_count || 0;

    if (currentCount >= DAILY_LIMIT) {
      return res.status(429).json({
        error: "daily_limit_reached",
        message: `You've reached your daily limit of ${DAILY_LIMIT} messages. Come back tomorrow! 🌅`,
        count: currentCount,
        limit: DAILY_LIMIT,
      });
    }

    // Incrementa il contatore
    await supabase
      .from("rate_limits")
      .upsert({
        user_id: user.id,
        date: today,
        message_count: currentCount + 1,
      }, { onConflict: "user_id,date" });

    // Chiama Anthropic
    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-haiku-4-5-20251001",
        max_tokens: max_tokens || 1500,
        system,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Restituisci anche info sul rate limit nell'header
    res.setHeader("X-RateLimit-Limit", DAILY_LIMIT);
    res.setHeader("X-RateLimit-Remaining", DAILY_LIMIT - (currentCount + 1));

    return res.status(200).json(data);

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}