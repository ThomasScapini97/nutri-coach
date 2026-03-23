import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function WeeklyChart({ data, calorieGoal = 2000 }) {
  const isEmpty = !data || data.every(d => d.calories === 0);

  if (isEmpty) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: "8px", padding: "24px 0",
      }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "14px",
          background: "#f0fdf4", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "22px",
        }}>📊</div>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>No data this week</p>
        <p style={{ fontSize: "11px", color: "#9ca3af", textAlign: "center", lineHeight: 1.5 }}>
          Start logging meals in the chat{"\n"}and your weekly trend will appear here
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "80px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
          />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "0.5px solid rgba(0,0,0,0.08)",
              borderRadius: "12px",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            formatter={(v) => [v > 0 ? `${v} kcal` : "No data", ""]}
          />
          <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
              const isToday = index === data.length - 1;
              const isEmpty = entry.calories === 0;
              const pct = calorieGoal > 0 ? entry.calories / calorieGoal : 0;
              const color = isEmpty
                ? "#f3f4f6"
                : isToday
                ? "#16a34a"
                : pct >= 0.9 && pct <= 1.1
                ? "#4ade80"
                : pct >= 0.7
                ? "#86efac"
                : "#bbf7d0";
              return <Cell key={index} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}