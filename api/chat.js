import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_LIMIT = 50;

// Estrai lista alimenti dal messaggio utente con AI leggera

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

    const today = new Date().toISOString().split("T")[0];

    // Atomic increment — uses a Postgres function to avoid read-check-write race condition
    const { data: newCount, error: rateError } = await supabase
      .rpc("increment_rate_limit", { p_user_id: user.id, p_date: today });

    if (rateError) {
      console.error("Rate limit RPC error:", rateError);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (newCount > DAILY_LIMIT) {
      return res.status(429).json({
        error: "daily_limit_reached",
        message: `You've reached your daily limit of ${DAILY_LIMIT} messages. Come back tomorrow! 🌅`,
        count: newCount,
        limit: DAILY_LIMIT,
      });
    }

    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const ALLOWED_MODELS = ["claude-haiku-4-5-20251001"];
    const safeModel = ALLOWED_MODELS.includes(model) ? model : "claude-haiku-4-5-20251001";
    const safeMaxTokens = Math.min(Math.max(Number(max_tokens) || 1500, 100), 2000);

    const enhancedSystem = system;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: safeModel,
        max_tokens: safeMaxTokens,
        system: enhancedSystem,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, JSON.stringify(data));
      return res.status(response.status).json({ error: "AI service error. Please try again." });
    }

    res.setHeader("X-RateLimit-Limit", DAILY_LIMIT);
    res.setHeader("X-RateLimit-Remaining", Math.max(DAILY_LIMIT - newCount, 0));

    return res.status(200).json(data);

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}