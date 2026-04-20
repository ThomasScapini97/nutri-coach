const ITALIAN_TO_ENGLISH = {
  "sottilette": "processed cheese slices",
  "sottiletta": "processed cheese slices",
  "marmellata": "jam",
  "prosciutto": "cured ham",
  "bresaola": "beef bresaola",
  "pancetta": "bacon pancetta",
  "mortadella": "mortadella bologna",
  "speck": "speck ham",
  "burrata": "burrata cheese",
  "ricotta": "ricotta cheese",
  "grana": "grana padano cheese",
  "pecorino": "pecorino cheese",
  "scamorza": "scamorza cheese",
  "lenticchie": "lentils",
  "ceci": "chickpeas",
  "fagioli": "beans",
  "farro": "farro spelt",
  "polenta": "polenta cornmeal",
  "gnocchi": "gnocchi potato",
  "focaccia": "focaccia bread",
  "grissini": "breadsticks grissini",
  "cioccolato": "chocolate",
  "gelato": "ice cream gelato",
  "cornetto": "croissant",
  "brioche": "brioche bread",
  "salame": "salami",
  "coppa": "coppa salumi",
};

const trySearch = async (searchQuery, countryFilter = true) => {
  const q = encodeURIComponent(searchQuery);
  const cc = countryFilter ? "&lc=it&cc=it" : "";
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=10${cc}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "NutriCoach/1.0 (privacy@nutricoach.app)" },
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) return [];
  const data = await response.json();

  return (data.products || []).filter(p => {
    const n = p.nutriments;
    return n && (n["energy-kcal_100g"] > 0 || n["energy_100g"] > 0) && p.product_name;
  }).map(p => ({
    id: p.id || p.code,
    name: p.product_name,
    brand: p.brands || "",
    image: p.image_small_url || null,
    per100: {
      calories: Math.round(p.nutriments["energy-kcal_100g"] || (p.nutriments["energy_100g"] || 0) / 4.184),
      protein: Math.round((p.nutriments["proteins_100g"] || 0) * 10) / 10,
      carbs: Math.round((p.nutriments["carbohydrates_100g"] || 0) * 10) / 10,
      fats: Math.round((p.nutriments["fat_100g"] || 0) * 10) / 10,
      fiber: Math.round((p.nutriments["fiber_100g"] || 0) * 10) / 10,
    },
  }));
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.query;
  if (!query || query.length < 2) {
    return res.status(400).json({ error: "Query too short" });
  }

  try {
    // Step 1: exact name, Italy
    let results = await trySearch(query, true);

    // Step 2: English translation, Italy
    if (results.length === 0) {
      const english = ITALIAN_TO_ENGLISH[query.toLowerCase()];
      if (english) results = await trySearch(english, true);
    }

    // Step 3: exact name, world
    if (results.length === 0) {
      results = await trySearch(query, false);
    }

    // Step 4: English translation, world
    if (results.length === 0) {
      const english = ITALIAN_TO_ENGLISH[query.toLowerCase()];
      if (english) results = await trySearch(english, false);
    }

    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json({ results: results.slice(0, 10) });

  } catch (error) {
    console.error("Food search error:", error);
    return res.status(500).json({ error: "Search failed", results: [] });
  }
}
