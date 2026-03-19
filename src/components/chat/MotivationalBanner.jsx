import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Heart, Zap } from "lucide-react";

const motivationalMessages = [
  { icon: Sparkles, message: "Great job staying within your calorie goal today!", color: "text-primary" },
  { icon: TrendingUp, message: "You're close to your protein target!", color: "text-chart-4" },
  { icon: Heart, message: "Try adding more vegetables for extra fiber.", color: "text-accent" },
  { icon: Zap, message: "Keep up the amazing work! You're on track.", color: "text-primary" },
];

export default function MotivationalBanner({ todayLog, calorieGoal }) {
  if (!todayLog) return null;
  const calories = todayLog.total_calories || 0;
  const protein = todayLog.total_protein || 0;
  const fiber = todayLog.total_fiber || 0;
  let selected = motivationalMessages[3];
  if (calories > 0 && calories <= calorieGoal) selected = motivationalMessages[0];
  else if (protein > 80) selected = motivationalMessages[1];
  else if (fiber < 20) selected = motivationalMessages[2];
  const Icon = selected.icon;
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 mb-2 p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shrink-0">
          <Icon className={`w-5 h-5 ${selected.color}`} />
        </div>
        <p className="text-sm font-medium text-foreground">{selected.message}</p>
      </div>
    </motion.div>
  );
}