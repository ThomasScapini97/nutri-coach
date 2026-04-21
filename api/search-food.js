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

const searchUSDA = async (query) => {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${process.env.USDA_API_KEY}&pageSize=15&dataType=Foundation,SR%20Legacy,Branded`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const data = await response.json();

    return (data.foods || [])
      .filter(food => {
        const calories = food.foodNutrients?.find(n => n.nutrientId === 1008 || n.nutrientName?.includes("Energy"))?.value;
        return calories > 0;
      })
      .map(food => {
        const getNutrient = (ids) => {
          for (const id of ids) {
            const n = food.foodNutrients?.find(n => n.nutrientId === id);
            if (n?.value) return Math.round(n.value * 10) / 10;
          }
          return 0;
        };
        return {
          id: `usda_${food.fdcId}`,
          name: food.description || query,
          brand: food.brandOwner || food.brandName || "",
          image: null,
          source: "usda",
          per100: {
            calories: Math.round(getNutrient([1008, 2047, 2048])),
            protein: getNutrient([1003]),
            carbs: getNutrient([1005]),
            fats: getNutrient([1004]),
            fiber: getNutrient([1079]),
          },
        };
      })
      .filter(f => f.per100.calories > 0);
  } catch {
    return [];
  }
};

const searchOFF = async (query) => {
  const trySearch = async (searchQuery, countryFilter = true) => {
    const q = encodeURIComponent(searchQuery);
    const cc = countryFilter ? "&lc=it&cc=it" : "";
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=15${cc}&fields=product_name,brands,nutriments,image_small_url,id,code`;
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
      source: "off",
      per100: {
        calories: Math.round(p.nutriments["energy-kcal_100g"] || (p.nutriments["energy_100g"] || 0) / 4.184),
        protein: Math.round((p.nutriments["proteins_100g"] || 0) * 10) / 10,
        carbs: Math.round((p.nutriments["carbohydrates_100g"] || 0) * 10) / 10,
        fats: Math.round((p.nutriments["fat_100g"] || 0) * 10) / 10,
        fiber: Math.round((p.nutriments["fiber_100g"] || 0) * 10) / 10,
      },
    }));
  };

  // Step 1: exact name, Italy
  let results = await trySearch(query, true);
  if (results.length > 0) return results;

  // Step 2: English translation, Italy
  const english = ITALIAN_TO_ENGLISH[query.toLowerCase()];
  if (english) {
    results = await trySearch(english, true);
    if (results.length > 0) return results;
  }

  // Step 3: exact name, world
  results = await trySearch(query, false);
  if (results.length > 0) return results;

  // Step 4: English translation, world
  if (english) {
    results = await trySearch(english, false);
  }

  return results;
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.query;
  if (!query || query.length < 1) return res.status(400).json({ error: "Query too short" });

  try {
    const english = ITALIAN_TO_ENGLISH[query.toLowerCase()];
    const searchPromises = [searchUSDA(query), searchOFF(query)];
    if (english && english !== query) {
      searchPromises.push(searchUSDA(english));
      searchPromises.push(searchOFF(english));
    }
    const allResults = await Promise.all(searchPromises);

    const seen = new Set();
    const merged = [];
    for (const results of allResults) {
      for (const item of results) {
        const key = item.name.toLowerCase().trim();
        if (!seen.has(key) && item.per100.calories > 0) {
          seen.add(key);
          merged.push(item);
        }
      }
    }

    // Sort: items whose name starts with query first
    const q = query.toLowerCase();
    merged.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts;
    });

    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).json({ results: merged.slice(0, 10) });

  } catch (error) {
    console.error("Food search error:", error);
    return res.status(500).json({ error: "Search failed", results: [] });
  }
}
