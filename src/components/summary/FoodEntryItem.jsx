import { useState, useRef } from "react";
import { Flame, Coffee, Utensils, Moon, Cookie, Plus, Minus } from "lucide-react";
import { motion } from "framer-motion";

const foodEmojis = { pasta: "🍝", chicken: "🐔", pollo: "🐔", beef: "🥩", manzo: "🥩", fish: "🐟", pesce: "🐟", salmone: "🐟", tonno: "🐟", rice: "🍚", riso: "🍚", bread: "🍞", pane: "🍞", egg: "🥚", uovo: "🥚", uova: "🥚", cheese: "🧀", parmigiano: "🧀", mozzarella: "🧀", apple: "🍎", mela: "🍎", banana: "🍌", salad: "🥗", insalata: "🥗", pizza: "🍕", burger: "🍔", oatmeal: "🥣", avena: "🥣", yogurt: "🥛", nuts: "🥜", bresaola: "🥩", prosciutto: "🥩", olio: "🫒", avocado: "🥑" };

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

export default function FoodEntryItem({ entry, quantity = 1, onAdd, onRemove, onUpdateGrams }) {
  const MealIcon = mealIcons[entry.meal_type] || Utensils;
  const mealStyle = mealStyles[entry.meal_type] || { bg: "#f3f4f6", color: "#6b7280" };
  const [editingGrams, setEditingGrams] = useState(false);
  const [gramsValue, setGramsValue] = useState(entry.grams ? String(Math.round(entry.grams)) : "");
  const inputRef = useRef(null);

  const handleGramsClick = () => {
    if (!onUpdateGrams) return;
    setEditingGrams(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleGramsConfirm = () => {
    setEditingGrams(false);
    const newGrams = parseFloat(gramsValue);
    if (!newGrams || newGrams <= 0 || newGrams === entry.grams) return;
    onUpdateGrams(entry, newGrams);
  };

  const handleGramsKeyDown = (e) => {
    if (e.key === "Enter") handleGramsConfirm();
    if (e.key === "Escape") {
      setEditingGrams(false);
      setGramsValue(entry.grams ? String(Math.round(entry.grams)) : "");
    }
  };

  const gramsLabel = entry.grams ? `${Math.round(entry.grams)}g` : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between px-3 py-[10px] rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
    >
      {/* Left: emoji + name + badges */}
      <div className="flex items-center gap-[10px] flex-1 min-w-0">
        <span className="text-[22px] shrink-0">{getFoodEmoji(entry.food_name)}</span>
        <div className="min-w-0">
          {/* Name + grams */}
          <div className="flex items-baseline gap-[5px]">
            <p className="text-[13px] font-medium text-forest truncate">
              {entry.food_name}
            </p>

            {editingGrams ? (
              <input
                ref={inputRef}
                type="number"
                value={gramsValue}
                onChange={e => setGramsValue(e.target.value)}
                onBlur={handleGramsConfirm}
                onKeyDown={handleGramsKeyDown}
                className="w-[52px] text-[11px] text-green-600 font-semibold border border-green-600 rounded-[6px] px-1 py-[1px] outline-none bg-green-50 font-[inherit]"
              />
            ) : gramsLabel ? (
              <span
                onClick={handleGramsClick}
                title={onUpdateGrams ? "Tap to edit" : ""}
                className={`text-[11px] text-forest font-medium shrink-0 bg-white border border-gray-200 rounded-full px-2 py-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${onUpdateGrams ? "cursor-pointer" : "cursor-default"}`}
              >
                {gramsLabel}
              </span>
            ) : onUpdateGrams ? (
              <span
                onClick={handleGramsClick}
                className="text-[10px] text-gray-400 cursor-pointer bg-white border border-gray-200 rounded-full px-2 py-[2px] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                + add g
              </span>
            ) : null}
          </div>

          {/* Meal badge */}
          <div className="flex items-center gap-[5px] mt-[3px]">
            {entry.meal_type && (
              <span
                className="text-[10px] py-[2px] px-[7px] rounded-full font-medium inline-flex items-center gap-[3px]"
                style={{ background: mealStyle.bg, color: mealStyle.color }}
              >
                <MealIcon className="w-[10px] h-[10px]" />
                {entry.meal_type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: calories + quantity controls */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-[3px] bg-red-50 rounded-full py-[3px] px-2">
          <Flame className="w-3 h-3 text-red-600" />
          <span className="text-xs font-semibold text-red-600">{Math.round(entry.calories || 0)}</span>
        </div>

        <div className="flex items-center bg-gray-50 rounded-full border border-gray-200 overflow-hidden">
          <button
            onClick={() => onRemove?.()}
            className="w-7 h-7 border-none bg-transparent cursor-pointer flex items-center justify-center text-gray-400"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-semibold text-forest min-w-[16px] text-center">
            {quantity}
          </span>
          <button
            onClick={() => onAdd?.()}
            className="w-7 h-7 border-none bg-transparent cursor-pointer flex items-center justify-center text-green-600"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
