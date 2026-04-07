import { Flame, Wheat, Drumstick, Droplets, Salad } from "lucide-react";
import { motion } from "framer-motion";

const macros = [
  { key: "calories", label: "Calories", unit: "kcal", icon: Flame, color: "text-accent", bgColor: "bg-accent/10" },
  { key: "carbs", label: "Carbs", unit: "g", icon: Wheat, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { key: "protein", label: "Protein", unit: "g", icon: Drumstick, color: "text-red-400", bgColor: "bg-red-400/10" },
  { key: "fats", label: "Fats", unit: "g", icon: Droplets, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { key: "fiber", label: "Fiber", unit: "g", icon: Salad, color: "text-emerald-500", bgColor: "bg-emerald-100" },
];

const mealEmojis = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function NutritionCard({ nutrition, foodEntries }) {
  if (!nutrition?.foods?.length) return null;

  // Try to resolve entries from foodEntries via entry_id (accurate, real-time data).
  // Fall back to the data embedded in nutrition.foods for old messages where entry_id is missing.
  const rawEntries = nutrition.foods.map(f => {
    if (f.entry_id && foodEntries?.length) {
      const match = foodEntries.find(e => e.id === f.entry_id);
      if (match) return match;
    }
    // Fallback: use data stored directly in the nutrition object
    if (f.food_name || f.calories) return f;
    return null;
  }).filter(Boolean);

  if (rawEntries.length === 0) return null;

  // Raggruppa per meal_type
  const grouped = rawEntries.reduce((acc, entry) => {
    const meal = entry.meal_type || "snack";
    if (!acc[meal]) {
      acc[meal] = {
        meal_type: meal,
        foods: [],
        calories: 0,
        carbs: 0,
        protein: 0,
        fats: 0,
        fiber: 0,
      };
    }
    acc[meal].foodCounts = acc[meal].foodCounts || {};
    const name = entry.food_name || "?";
    acc[meal].foodCounts[name] = (acc[meal].foodCounts[name] || 0) + 1;
    acc[meal].calories += entry.calories || 0;
    acc[meal].carbs += entry.carbs || 0;
    acc[meal].protein += entry.protein || 0;
    acc[meal].fats += entry.fats || 0;
    acc[meal].fiber += entry.fiber || 0;
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl">
      {Object.values(grouped).map((group, i) => (
        <div key={i} className="mb-3 last:mb-0 bg-white rounded-2xl p-4 shadow-md border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{mealEmojis[group.meal_type] || "🍽️"}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{mealLabels[group.meal_type] || group.meal_type}</p>
              <p className="text-xs text-muted-foreground">
                {Object.entries(group.foodCounts || {}).map(([name, count]) => count > 1 ? `${name} x${count}` : name).join(", ")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
  {macros.map(({ key, label, unit, icon: Icon, color, bgColor }) => (
<div key={key} className="flex flex-col items-center text-center gap-1">
  <div className={`w-9 h-9 rounded-full ${bgColor} flex items-center justify-center`}>
    <Icon className={`w-4 h-4 ${color}`} />
  </div>
  <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
  <span className="text-xs font-bold text-foreground">{Math.round(group[key] ?? 0)}<span className="text-[10px] font-normal text-muted-foreground">{unit}</span></span>
</div>
  ))}
</div>
        </div>
      ))}
    </motion.div>
  );
}