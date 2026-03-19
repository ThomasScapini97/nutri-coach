import { Flame, Coffee, Utensils, Moon, Cookie, Plus, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const foodEmojis = { pasta: "🍝", chicken: "🐔", beef: "🥩", fish: "🐟", rice: "🍚", bread: "🍞", egg: "🥚", cheese: "🧀", apple: "🍎", banana: "🍌", salad: "🥗", pizza: "🍕", burger: "🍔", oatmeal: "🥣", yogurt: "🥛", nuts: "🥜" };
const mealIcons = { breakfast: Coffee, lunch: Utensils, dinner: Moon, snack: Cookie };
const mealColors = { breakfast: "bg-amber-100 text-amber-700", lunch: "bg-blue-100 text-blue-700", dinner: "bg-purple-100 text-purple-700", snack: "bg-green-100 text-green-700" };

function getFoodEmoji(foodName) {
  const name = foodName.toLowerCase();
  for (const [key, emoji] of Object.entries(foodEmojis)) { if (name.includes(key)) return emoji; }
  return "🍽️";
}

export default function FoodEntryItem({ entry, quantity = 1, onAdd, onRemove }) {
  const MealIcon = mealIcons[entry.meal_type] || Utensils;
  const mealColor = mealColors[entry.meal_type] || "bg-gray-100 text-gray-700";
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between py-3.5 px-4 rounded-2xl bg-white hover:bg-primary/5 transition-all border border-border/50 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{getFoodEmoji(entry.food_name)}</span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {entry.food_name}
            <span className="ml-1.5 text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">×{quantity}</span>
          </p>
          {entry.meal_type && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 mt-1 ${mealColor}`}>
              <MealIcon className="w-3 h-3" />{entry.meal_type}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-sm font-bold text-accent">
          <Flame className="w-3.5 h-3.5" />{Math.round(entry.calories || 0)}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onRemove?.()} className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onAdd?.()} className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}