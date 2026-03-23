import { motion } from "framer-motion";

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "flex", gap: "12px", alignItems: "flex-end", maxWidth: "320px" }}
    >
      {/* Avatar */}
      <div style={{
        width: "36px", height: "36px", borderRadius: "50%",
        background: "linear-gradient(135deg, #16a34a, #15803d)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
      }}>
        🍎
      </div>

      {/* Bubble */}
      <div style={{
        background: "white",
        borderRadius: "18px 18px 18px 4px",
        padding: "14px 18px",
        border: "0.5px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minWidth: "64px",
        justifyContent: "center",
      }}>
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              delay,
              ease: "easeInOut",
            }}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#16a34a",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}