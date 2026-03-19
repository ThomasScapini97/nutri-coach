import { Flame, Wheat, Drumstick, Droplets, Salad } from "lucide-react";
import { motion } from "framer-motion";

const macros = [
  { key: "calories", label: "Calories", unit: "kcal", icon: Flame, color: "text-accent", bgColor: "bg-accent/10" },
  { key: "carbs", label: "Carbs", unit: "g", icon: Wheat, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { key: "protein", label: "Protein", unit: "g", icon: Drumstick, color: "text-red-400", bgColor: "bg-red-400/10" },
  { key: "fats", label: "Fats", unit: "g", icon: Droplets, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { key: "fiber", label: "Fiber", unit: "g", icon: Salad, color: "text-primary", bgColor: "bg-primary/10" },
];

const foodEmojis = {
  pasta: "🍝", chicken: "🐔", beef: "🥩", fish: "🐟", salmon: "🐟",
  rice: "🍚", bread: "🍞", egg: "🥚", cheese: "🧀", milk: "🥛",
  apple: "🍎", banana: "🍌", orange: "🍊", yogurt: "🥛", nuts: "🥜",
  salad: "🥗", pizza: "🍕", burger: "🍔", oatmeal: "🥣", potato: "🥔",
};

function getFoodEmoji(foodName) {
  const name = foodName.toLowerCase();
  for (const [key, emoji] of Object.entries(foodEmojis)) {
    if (name.includes(key)) return emoji;
  }
  return "🍽️";
}

export default function NutritionCard({ nutrition, foodEntries }) {
  if (!nutrition?.foods?.length || !foodEntries?.length) return null;
  const entryIds = nutrition.foods.map(f => f.entry_id).filter(Boolean);
  const rawEntries = entryIds.map(id => foodEntries.find(e => e.id === id)).filter(Boolean);
  if (rawEntries.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl">
      {rawEntries.map((entry, i) => (
        <div key={entry.id} className="mb-3 last:mb-0 bg-white rounded-2xl p-4 shadow-md border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{getFoodEmoji(entry.food_name)}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{entry.food_name}</p>
              <p className="text-xs text-muted-foreground">{entry.meal_type}</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {macros.map(({ key, label, unit, icon: Icon, color, bgColor }) => (
              <div key={key} className="flex flex-col items-center text-center">
                <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center mb-1.5`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className="text-sm font-bold text-foreground">{entry[key] ?? 0}</span>
                <span className="text-[10px] text-muted-foreground">{unit}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}