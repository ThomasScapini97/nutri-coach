import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DailyNotificationPopup({ evaluation, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { if (evaluation) setIsVisible(true); }, [evaluation]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleClick = () => {
    setIsVisible(false);
    setTimeout(() => { navigate("/Summary"); onClose(); }, 300);
  };

  if (!evaluation) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Overlay cliccabile per chiudere */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998 }}
            onClick={handleClose}
          />

          {/* Popup compatto dal basso */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              position: "fixed", bottom: 100, left: "16px", right: "16px",
              zIndex: 9999, maxWidth: "480px", margin: "0 auto",
            }}
          >
            <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden" }}>

              {/* Header compatto */}
              <div style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                padding: "14px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles style={{ width: "18px", height: "18px", color: "white" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "white", lineHeight: 1.2 }}>{evaluation.title}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>Daily summary</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X style={{ width: "14px", height: "14px", color: "white" }} />
                </button>
              </div>

              {/* Body compatto */}
              <div style={{ padding: "14px 16px" }}>
                <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "12px", lineHeight: 1.5 }}>
                  {evaluation.message}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0fdf4", borderRadius: "12px", padding: "10px 14px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>Calories</span>
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "#1a3a22" }}>
                    {Math.round(evaluation.calories)} / {evaluation.calorieGoal} kcal
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleClose}
                    style={{ flex: 1, background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: "12px", padding: "10px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleClick}
                    style={{ flex: 2, background: "#16a34a", color: "white", border: "none", borderRadius: "12px", padding: "10px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    View Summary →
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}