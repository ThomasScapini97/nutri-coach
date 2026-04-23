import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Coffee, Utensils, Moon, Cookie, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const foodEmojis = { pasta: "🍝", chicken: "🐔", pollo: "🐔", beef: "🥩", manzo: "🥩", fish: "🐟", pesce: "🐟", salmone: "🐟", tonno: "🐟", rice: "🍚", riso: "🍚", bread: "🍞", pane: "🍞", egg: "🥚", uovo: "🥚", uova: "🥚", cheese: "🧀", parmigiano: "🧀", mozzarella: "🧀", apple: "🍎", mela: "🍎", banana: "🍌", salad: "🥗", insalata: "🥗", pizza: "🍕", burger: "🍔", oatmeal: "🥣", avena: "🥣", yogurt: "🥛", nuts: "🥜", bresaola: "🥩", prosciutto: "🥩", olio: "🫒", avocado: "🥑" };

const MEAL_OPTIONS = [
  { value: "breakfast", Icon: Coffee,  label: "Breakfast", bg: "#fef3c7", color: "#92400e" },
  { value: "lunch",     Icon: Utensils, label: "Lunch",     bg: "#dbeafe", color: "#1e40af" },
  { value: "dinner",    Icon: Moon,     label: "Dinner",    bg: "#ede9fe", color: "#5b21b6" },
  { value: "snack",     Icon: Cookie,   label: "Snack",     bg: "#dcfce7", color: "#166534" },
];

function getFoodEmoji(foodName) {
  const name = foodName.toLowerCase();
  for (const [key, emoji] of Object.entries(foodEmojis)) { if (name.includes(key)) return emoji; }
  return "🍽️";
}

export default function FoodEntryItem({ entry, quantity = 1, onAdd, onRemove, onUpdateGrams, onChangeMealType }) {
  const { t } = useTranslation();
  const currentMeal = MEAL_OPTIONS.find(m => m.value === entry.meal_type) || MEAL_OPTIONS[1];
  const [editingGrams, setEditingGrams] = useState(false);
  const [gramsValue, setGramsValue] = useState(entry.grams ? String(Math.round(entry.grams)) : "");
  const [showMealPicker, setShowMealPicker] = useState(false);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!showMealPicker) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowMealPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [showMealPicker]);

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

  const handleBadgeClick = () => {
    if (!onChangeMealType) return;
    setShowMealPicker(prev => !prev);
  };

  const handleSelectMeal = (value) => {
    setShowMealPicker(false);
    if (value !== entry.meal_type) onChangeMealType(entry, value);
  };

  const gramsLabel = entry.grams ? `${Math.round(entry.grams)}g` : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center justify-between px-3 py-[10px]">
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
                  {t("common.addG")}
                </span>
              ) : null}
            </div>

            {/* Meal badge */}
            <div className="flex items-center gap-[5px] mt-[3px]">
              {entry.meal_type && (
                <span
                  onClick={handleBadgeClick}
                  className={`text-[10px] py-[2px] px-[7px] rounded-full font-medium inline-flex items-center gap-[3px] ${onChangeMealType ? "cursor-pointer active:opacity-70" : ""}`}
                  style={{ background: currentMeal.bg, color: currentMeal.color }}
                >
                  <currentMeal.Icon className="w-[10px] h-[10px]" />
                  {currentMeal.label}
                  {onChangeMealType && <span style={{ fontSize: "8px", opacity: 0.6 }}>▾</span>}
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
      </div>

      {/* Meal picker */}
      <AnimatePresence>
        {showMealPicker && (
          <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex gap-2 px-3 pb-3">
              {MEAL_OPTIONS.map(({ value, Icon, label, bg, color }) => (
                <button
                  key={value}
                  onClick={() => handleSelectMeal(value)}
                  className="flex-1 flex flex-col items-center gap-[3px] py-2 rounded-xl border transition-all"
                  style={{
                    background: value === entry.meal_type ? bg : "#f9fafb",
                    borderColor: value === entry.meal_type ? color : "#e5e7eb",
                    color: value === entry.meal_type ? color : "#6b7280",
                    fontWeight: value === entry.meal_type ? 600 : 400,
                  }}
                >
                  <Icon style={{ width: 14, height: 14 }} />
                  <span style={{ fontSize: "10px" }}>{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
