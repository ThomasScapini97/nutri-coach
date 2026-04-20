import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_LIMIT = 50;

const ITALIAN_TO_ENGLISH = {
  "sottilette": "processed cheese slices",
  "sottiletta": "processed cheese slices",
  "marmellata": "jam",
  "prosciutto": "cured ham",
  "bresaola": "beef bresaola",
  "pancetta": "bacon pancetta",
  "mortadella": "mortadella bologna",
  "speck": "speck ham",
  "nduja": "nduja spreadable salami",
  "burrata": "burrata cheese",
  "ricotta": "ricotta cheese",
  "grana": "grana padano cheese",
  "pecorino": "pecorino cheese",
  "scamorza": "scamorza cheese",
  "feta": "feta cheese",
  "brie": "brie cheese",
  "camembert": "camembert cheese",
  "prosciutto cotto": "cooked ham",
  "salame": "salami",
  "coppa": "coppa salumi",
  "lenticchie": "lentils",
  "ceci": "chickpeas",
  "fagioli": "beans",
  "farro": "farro spelt",
  "orzo": "barley",
  "polenta": "polenta cornmeal",
  "gnocchi": "gnocchi potato",
  "focaccia": "focaccia bread",
  "grissini": "breadsticks grissini",
  "crackers": "crackers",
  "biscotti": "cookies biscuits",
  "cornetto": "croissant",
  "brioche": "brioche bread",
  "cioccolato": "chocolate",
  "nutella": "nutella hazelnut spread",
  "gelato": "ice cream gelato",
};

async function searchOpenFoodFacts(foodName) {
  const trySearch = async (query, countryFilter = true) => {
    try {
      const q = encodeURIComponent(query);
      const cc = countryFilter ? "&lc=it&cc=it" : "&lc=it";
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=5${cc}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "NutriCoach/1.0 (privacy@nutricoach.app)" },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const products = data.products || [];
      for (const product of products) {
        const n = product.nutriments;
        if (!n) continue;
        const per100 = {
          calories: Math.round(n["energy-kcal_100g"] || (n["energy_100g"] || 0) / 4.184 || 0),
          protein: Math.round((n["proteins_100g"] || 0) * 10) / 10,
          carbs: Math.round((n["carbohydrates_100g"] || 0) * 10) / 10,
          fats: Math.round((n["fat_100g"] || 0) * 10) / 10,
          fiber: Math.round((n["fiber_100g"] || 0) * 10) / 10,
        };
        if (per100.calories > 0) {
          return { name: product.product_name || foodName, per100 };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  // Step 1: exact Italian name, Italy filter
  let result = await trySearch(foodName, true);
  if (result) return result;

  // Step 2: English translation if available, Italy filter
  const englishName = ITALIAN_TO_ENGLISH[foodName.toLowerCase()];
  if (englishName) {
    result = await trySearch(englishName, true);
    if (result) return result;
  }

  // Step 3: exact Italian name, world database (no country filter)
  result = await trySearch(foodName, false);
  if (result) return result;

  // Step 4: English translation, world database
  if (englishName) {
    result = await trySearch(englishName, false);
    if (result) return result;
  }

  // Step 5: no results found
  return null;
}

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