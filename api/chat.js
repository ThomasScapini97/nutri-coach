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

async function checkProductDatabase(foodName) {
  try {
    const { data } = await supabase
      .from('product_database')
      .select('product_name, brand, calories_100g, protein_100g, carbs_100g, fats_100g, fiber_100g')
      .ilike('product_name', `%${foodName}%`)
      .order('scan_count', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data || !data.calories_100g) return null;
    return {
      name: `${data.product_name}${data.brand ? ` (${data.brand})` : ''}`,
      per100: {
        calories: Math.round(data.calories_100g),
        protein: Math.round((data.protein_100g || 0) * 10) / 10,
        carbs: Math.round((data.carbs_100g || 0) * 10) / 10,
        fats: Math.round((data.fats_100g || 0) * 10) / 10,
        fiber: Math.round((data.fiber_100g || 0) * 10) / 10,
      },
    };
  } catch {
    return null;
  }
}

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
    const safeMaxTokens = Math.min(Math.max(Number(max_tokens) || 1500, 100), 4000);

    // Extract text from last user message
    const lastUserMessage = messages[messages.length - 1];
    const userText = typeof lastUserMessage?.content === "string"
      ? lastUserMessage.content
      : lastUserMessage?.content?.find(c => c.type === "text")?.text || "";

    let offDataContext = "";

    if (userText.length > 0) {
      const words = userText.toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 3 && !/^\d+$/.test(w));

      const bigrams = [];
      for (let i = 0; i < words.length - 1; i++) {
        bigrams.push(`${words[i]} ${words[i + 1]}`);
      }

      const candidates = [...bigrams, ...words].slice(0, 3);

      const [localResults, offResults] = await Promise.all([
        Promise.all(candidates.map(term => checkProductDatabase(term))),
        Promise.all(candidates.map(term => searchOpenFoodFacts(term))),
      ]);

      const localFound = localResults.filter(Boolean);
      const offFound = offResults.filter(Boolean);

      if (localFound.length > 0 || offFound.length > 0) {
        offDataContext = "\n\n**REAL NUTRITIONAL DATA FROM DATABASE (use these exact values):**\n";
        localFound.forEach(item => {
          offDataContext += `- ${item.name} [verified]: ${item.per100.calories} kcal/100g, ${item.per100.protein}g protein, ${item.per100.carbs}g carbs, ${item.per100.fats}g fat, ${item.per100.fiber}g fiber\n`;
        });
        offFound.forEach(item => {
          offDataContext += `- ${item.name}: ${item.per100.calories} kcal/100g, ${item.per100.protein}g protein, ${item.per100.carbs}g carbs, ${item.per100.fats}g fat, ${item.per100.fiber}g fiber\n`;
        });
        offDataContext += "These are verified values — always prefer these over your estimates.\n";
      }

      // USDA fallback if OFF found nothing
      if (offDataContext === "" && process.env.USDA_API_KEY) {
        const usdaWords = words.filter(w => w.length >= 4).slice(0, 2);
        for (const word of usdaWords) {
          try {
            const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(word)}&api_key=${process.env.USDA_API_KEY}&pageSize=3&dataType=Foundation,SR%20Legacy,Branded`;
            const usdaRes = await fetch(usdaUrl, { signal: AbortSignal.timeout(2000) });
            if (usdaRes.ok) {
              const usdaData = await usdaRes.json();
              const food = usdaData.foods?.[0];
              if (food) {
                const getNutrient = (id) => food.foodNutrients?.find(n => n.nutrientId === id)?.value || 0;
                const cal = Math.round(getNutrient(1008));
                if (cal > 0) {
                  offDataContext += `\n\n**USDA DATA for ${food.description}:** ${cal} kcal/100g, ${Math.round(getNutrient(1003) * 10) / 10}g protein, ${Math.round(getNutrient(1005) * 10) / 10}g carbs, ${Math.round(getNutrient(1004) * 10) / 10}g fat\n`;
                }
              }
            }
          } catch { /* silent */ }
        }
      }
    }

    const enhancedSystem = offDataContext ? system + offDataContext : system;

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