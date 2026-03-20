import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

export default function WeeklyChart({ data, calorieGoal = 2000 }) {
  if (!data || data.length === 0) return null;

  const today = data[data.length - 1];

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
            formatter={(v) => [`${v} kcal`, ""]}
          />
          <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
              const isToday = index === data.length - 1;
              const pct = calorieGoal > 0 ? entry.calories / calorieGoal : 0;
              const color = isToday
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