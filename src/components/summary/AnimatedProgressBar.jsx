import { motion } from "framer-motion";

export default function AnimatedProgressBar({ label, value, max, unit, color = "primary" }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 85 && !isDanger;

  const barColor = isDanger
    ? "#ef4444"
    : isWarning
    ? "#f97316"
    : color === "chart-4" ? "#ef4444"
    : color === "chart-3" ? "#f59e0b"
    : color === "blue-500" ? "#3b82f6"
    : "#10b981";

  const bgColor = isDanger
    ? "#fee2e2"
    : isWarning
    ? "#ffedd5"
    : color === "chart-4" ? "#fee2e2"
    : color === "chart-3" ? "#fef3c7"
    : color === "blue-500" ? "#dbeafe"
    : "#dcfce7";

  return (
    <div
      style={{
        background: "white",
        borderRadius: "14px",
        padding: "12px",
        border: "0.5px solid rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: barColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 400 }}>{label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "6px" }}>
        <span style={{ fontSize: "18px", fontWeight: 500, color: "#1a3a22", lineHeight: 1 }}>
          {Math.round(value)}
        </span>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>{unit}</span>
        <span style={{ fontSize: "11px", color: "#9ca3af", marginLeft: "2px" }}>/ {max}{unit}</span>
      </div>

      <div style={{ background: "#f3f4f6", height: "4px", borderRadius: "99px", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: "99px", background: barColor }}
        />
      </div>
    </div>
  );
}