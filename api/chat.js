import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_LIMIT = 50;

// Cerca alimento su Open Food Facts
async function searchOpenFoodFacts(foodName) {
  try {
    const query = encodeURIComponent(foodName);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=3&lc=it&cc=it`;
    const res = await fetch(url, { 
      headers: { "User-Agent": "NutriCoach/1.0 (contact@nutricoach.app)" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const products = data.products || [];
    
    // Trova il primo prodotto con valori nutrizionali completi
    for (const product of products) {
      const n = product.nutriments;
      if (!n) continue;
      const per100 = {
        calories: Math.round(n["energy-kcal_100g"] || n["energy_100g"] / 4.184 || 0),
        protein: Math.round((n["proteins_100g"] || 0) * 10) / 10,
        carbs: Math.round((n["carbohydrates_100g"] || 0) * 10) / 10,
        fats: Math.round((n["fat_100g"] || 0) * 10) / 10,
        fiber: Math.round((n["fiber_100g"] || 0) * 10) / 10,
      };
      // Valida che abbia almeno calorie > 0
      if (per100.calories > 0) {
        return {
          name: product.product_name || foodName,
          per100,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Estrai lista alimenti dal messaggio utente con AI leggera
async function extractFoodsFromMessage(message, apiKey) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Extract only the food names from this message as a JSON array of strings. No quantities, no descriptions, just clean food names in Italian. If no food is mentioned, return [].
Message: "${message}"
Return ONLY a JSON array like: ["bresaola", "olio d'oliva", "parmigiano"]`,
        }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
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

    await supabase
      .from("rate_limits")
      .upsert({
        user_id: user.id,
        date: today,
        message_count: currentCount + 1,
      }, { onConflict: "user_id,date" });

    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // Ottieni l'ultimo messaggio utente
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.content || "";

    // Estrai alimenti e cerca su Open Food Facts in parallelo
    const foodNames = await extractFoodsFromMessage(lastUserMessage, process.env.ANTHROPIC_API_KEY);
    
    let nutritionContext = "";
    if (foodNames.length > 0) {
      const results = await Promise.all(foodNames.map(async (food) => {
        const data = await searchOpenFoodFacts(food);
        return { food, data };
      }));

      const found = results.filter(r => r.data);
      if (found.length > 0) {
        nutritionContext = "\n\n**REAL NUTRITION DATA from Open Food Facts database (use these exact values per 100g):**\n";
        found.forEach(({ food, data }) => {
          nutritionContext += `- ${food}: ${data.per100.calories} kcal, ${data.per100.protein}g protein, ${data.per100.carbs}g carbs, ${data.per100.fats}g fat, ${data.per100.fiber}g fiber\n`;
        });
        nutritionContext += "**IMPORTANT: Use ONLY these values for calculation. Ignore any hardcoded values in your instructions.**";
      }
    }

    // Aggiungi il contesto nutrizionale al system prompt
    const enhancedSystem = nutritionContext 
      ? system + nutritionContext 
      : system;

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
        system: enhancedSystem,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    res.setHeader("X-RateLimit-Limit", DAILY_LIMIT);
    res.setHeader("X-RateLimit-Remaining", DAILY_LIMIT - (currentCount + 1));

    return res.status(200).json(data);

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}