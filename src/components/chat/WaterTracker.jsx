import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

const GOAL = 8;

export default function WaterTracker({ todayLog, onUpdate }) {
  const glasses = todayLog?.water_glasses || 0;
  const [loading, setLoading] = useState(false);

  const updateGlasses = async (newCount) => {
    if (!todayLog?.id || loading) return;
    setLoading(true);
    await supabase
      .from("food_logs")
      .update({ water_glasses: newCount })
      .eq("id", todayLog.id);
    onUpdate();
    setLoading(false);
  };

  const add = () => { if (glasses < GOAL) updateGlasses(glasses + 1); };
  const remove = () => { if (glasses > 0) updateGlasses(glasses - 1); };

  const ml = glasses * 250;
  const percentage = Math.round((glasses / GOAL) * 100);

  return (
    <div style={{
      background: "white",
      borderTop: "0.5px solid rgba(0,0,0,0.06)",
      padding: "10px 16px",
    }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "14px" }}>💧</span>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>Water</span>
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>{ml}ml / 2000ml</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={remove}
              disabled={glasses === 0 || loading}
              style={{
                width: "26px", height: "26px", borderRadius: "50%",
                background: glasses === 0 ? "#f9fafb" : "#f0fdf4",
                border: "0.5px solid " + (glasses === 0 ? "#e5e7eb" : "#bbf7d0"),
                color: glasses === 0 ? "#d1d5db" : "#16a34a",
                fontSize: "16px", cursor: glasses === 0 ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "inherit", lineHeight: 1,
              }}
            >−</button>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22", minWidth: "32px", textAlign: "center" }}>
              {glasses}/{GOAL}
            </span>
            <button
              onClick={add}
              disabled={glasses === GOAL || loading}
              style={{
                width: "26px", height: "26px", borderRadius: "50%",
                background: glasses === GOAL ? "#f9fafb" : "#16a34a",
                border: "none",
                color: glasses === GOAL ? "#d1d5db" : "white",
                fontSize: "16px", cursor: glasses === GOAL ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "inherit", lineHeight: 1,
              }}
            >+</button>
          </div>
        </div>

        {/* Glasses row */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {Array.from({ length: GOAL }).map((_, i) => (
            <motion.button
              key={i}
              onClick={() => updateGlasses(i < glasses ? i : i + 1)}
              initial={false}
              animate={{
                scale: i < glasses ? 1 : 0.9,
                opacity: i < glasses ? 1 : 0.35,
              }}
              transition={{ duration: 0.15 }}
              style={{
                flex: 1, height: "28px", borderRadius: "6px",
                background: i < glasses ? "#3b82f6" : "#e0f2fe",
                border: "none", cursor: "pointer",
                fontSize: "12px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {i < glasses ? "💧" : ""}
            </motion.button>
          ))}
        </div>

        {/* Goal reached message */}
        {glasses === GOAL && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: "11px", color: "#16a34a", textAlign: "center", marginTop: "6px", fontWeight: 500 }}
          >
            Daily water goal reached! 🎉
          </motion.p>
        )}
      </div>
    </div>
  );
}