import { Flame, Coffee, Utensils, Moon, Cookie, Plus, Minus } from "lucide-react";
import { motion } from "framer-motion";

const foodEmojis = { pasta: "🍝", chicken: "🐔", beef: "🥩", fish: "🐟", rice: "🍚", bread: "🍞", egg: "🥚", cheese: "🧀", apple: "🍎", banana: "🍌", salad: "🥗", pizza: "🍕", burger: "🍔", oatmeal: "🥣", yogurt: "🥛", nuts: "🥜" };
const mealIcons = { breakfast: Coffee, lunch: Utensils, dinner: Moon, snack: Cookie };
const mealStyles = {
  breakfast: { bg: "#fef3c7", color: "#92400e" },
  lunch: { bg: "#dbeafe", color: "#1e40af" },
  dinner: { bg: "#ede9fe", color: "#5b21b6" },
  snack: { bg: "#dcfce7", color: "#166534" },
};

function getFoodEmoji(foodName) {
  const name = foodName.toLowerCase();
  for (const [key, emoji] of Object.entries(foodEmojis)) { if (name.includes(key)) return emoji; }
  return "🍽️";
}

export default function FoodEntryItem({ entry, quantity = 1, onAdd, onRemove }) {
  const MealIcon = mealIcons[entry.meal_type] || Utensils;
  const mealStyle = mealStyles[entry.meal_type] || { bg: "#f3f4f6", color: "#6b7280" };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", borderRadius: "16px", background: "white",
        border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Sinistra: emoji + nome + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: "22px", flexShrink: 0 }}>{getFoodEmoji(entry.food_name)}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {entry.food_name}
          </p>
          {entry.meal_type && (
            <span style={{
              fontSize: "10px", padding: "2px 7px", borderRadius: "20px",
              background: mealStyle.bg, color: mealStyle.color,
              fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px",
            }}>
              <MealIcon style={{ width: "10px", height: "10px" }} />
              {entry.meal_type}
            </span>
          )}
        </div>
      </div>

      {/* Destra: kcal + controlli quantità */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {/* Kcal */}
        <div style={{
          display: "flex", alignItems: "center", gap: "3px",
          background: "#fef2f2", borderRadius: "20px", padding: "3px 8px",
        }}>
          <Flame style={{ width: "12px", height: "12px", color: "#dc2626" }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626" }}>{Math.round(entry.calories || 0)}</span>
        </div>

        {/* Controlli quantità */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0px",
          background: "#f9fafb", borderRadius: "20px",
          border: "0.5px solid #e5e7eb", overflow: "hidden",
        }}>
          <button
            onClick={() => onRemove?.()}
            style={{
              width: "28px", height: "28px", border: "none", background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#9ca3af", fontSize: "16px",
            }}
          >
            <Minus style={{ width: "12px", height: "12px" }} />
          </button>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1a3a22", minWidth: "16px", textAlign: "center" }}>
            {quantity}
          </span>
          <button
            onClick={() => onAdd?.()}
            style={{
              width: "28px", height: "28px", border: "none", background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#16a34a", fontSize: "16px",
            }}
          >
            <Plus style={{ width: "12px", height: "12px" }} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
