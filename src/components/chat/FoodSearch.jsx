import { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "@/components/ui/Spinner";

export default function FoodSearch({ onProductFound, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [grams, setGrams] = useState("100");
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchFood = async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search-food?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedProduct(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchFood(val), 400);
  };

  const handleSelect = (product) => {
    setSelectedProduct(product);
    setGrams("100");
  };

  const getCalPer100 = (product) => product.per100.calories;

  const getAdjusted = (product, g) => {
    const p = product.per100;
    const factor = g / 100;
    return {
      calories: Math.round(p.calories * factor),
      protein: Math.round(p.protein * factor * 10) / 10,
      carbs: Math.round(p.carbs * factor * 10) / 10,
      fats: Math.round(p.fats * factor * 10) / 10,
      fiber: Math.round(p.fiber * factor * 10) / 10,
    };
  };

  const handleConfirm = () => {
    if (!selectedProduct) return;
    const g = Number(grams) || 100;
    onProductFound({
      name: selectedProduct.name,
      grams: g,
      per100: selectedProduct.per100,
      adjusted: getAdjusted(selectedProduct, g),
    });
  };

  const adjustedPreview = selectedProduct ? getAdjusted(selectedProduct, Number(grams) || 100) : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "82vh",
            background: "white",
            borderRadius: "24px 24px 0 0",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Handle bar */}
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px", flexShrink: 0 }}>
            <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "#d1d5db" }} />
          </div>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 12px", flexShrink: 0 }}>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "#1a3a22", margin: 0 }}>Search food</p>
            <button
              onClick={onClose}
              style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
            </button>
          </div>

          {/* Search input */}
          <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#9ca3af" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={handleQueryChange}
                placeholder="e.g. sottilette, pasta, banana..."
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                  borderRadius: "12px", padding: "10px 12px 10px 36px",
                  fontSize: "15px", color: "#111827", outline: "none",
                  fontFamily: "inherit",
                }}
              />
              {loading && (
                <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
                  <Spinner size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* Results list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
            {!loading && query.length >= 2 && results.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: "14px" }}>
                No results found
              </div>
            )}

            {results.map((product, i) => {
              const calPer100 = getCalPer100(product);
              const isSelected = selectedProduct?.id === product.id;
              return (
                <div
                  key={product.id || i}
                  onClick={() => handleSelect(product)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", marginBottom: "6px",
                    background: isSelected ? "#f0fdf4" : "white",
                    borderRadius: "12px",
                    border: isSelected ? "1.5px solid #16a34a" : "0.5px solid rgba(0,0,0,0.06)",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {product.name}
                    </p>
                    {product.brand && (
                      <p style={{ fontSize: "11px", color: "#9ca3af", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {product.brand}
                      </p>
                    )}
                  </div>
                  <div style={{ background: "#fef2f2", borderRadius: "20px", padding: "3px 9px", flexShrink: 0 }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626" }}>{calPer100} kcal</span>
                    <span style={{ fontSize: "10px", color: "#9ca3af" }}>/100g</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected product — grams input + confirm */}
          <AnimatePresence>
            {selectedProduct && (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                style={{
                  flexShrink: 0, padding: "14px 16px",
                  borderTop: "0.5px solid rgba(0,0,0,0.08)",
                  background: "white",
                  paddingBottom: `calc(14px + env(safe-area-inset-bottom))`,
                }}
              >
                {/* Selected product name */}
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a3a22", margin: "0 0 10px" }}>
                  {selectedProduct.name}
                </p>

                {/* Grams input + nutrition preview */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={grams}
                      onChange={e => setGrams(e.target.value)}
                      placeholder="Grams"
                      min="1"
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: "#f9fafb", border: "1px solid #e5e7eb",
                        borderRadius: "10px", padding: "9px 12px",
                        fontSize: "15px", color: "#111827", outline: "none",
                        fontFamily: "inherit", textAlign: "center",
                      }}
                    />
                  </div>
                  {adjustedPreview && (
                    <div style={{ flex: 2, display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {[
                        { label: "kcal", value: adjustedPreview.calories, color: "#dc2626", bg: "#fef2f2" },
                        { label: "prot", value: `${adjustedPreview.protein}g`, color: "#2563eb", bg: "#eff6ff" },
                        { label: "carbs", value: `${adjustedPreview.carbs}g`, color: "#d97706", bg: "#fffbeb" },
                        { label: "fat", value: `${adjustedPreview.fats}g`, color: "#7c3aed", bg: "#f5f3ff" },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} style={{ background: bg, borderRadius: "8px", padding: "3px 7px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color }}>{value}</span>
                          <span style={{ fontSize: "9px", color: "#9ca3af" }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleConfirm}
                  style={{
                    width: "100%", background: "#16a34a", border: "none",
                    borderRadius: "12px", padding: "12px",
                    fontSize: "14px", fontWeight: 600, color: "white",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Add to log
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
