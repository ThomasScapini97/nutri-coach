import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function DaySuccessIndicator({ calories, calorieGoal }) {
  const percentage = (calories / calorieGoal) * 100;
  let Icon = XCircle, bgColor = 'bg-destructive/10', iconColor = 'text-destructive';
  if (percentage >= 90 && percentage <= 110) { Icon = CheckCircle2; bgColor = 'bg-primary/10'; iconColor = 'text-primary'; }
  else if ((percentage >= 80 && percentage < 90) || (percentage > 110 && percentage <= 120)) { Icon = AlertCircle; bgColor = 'bg-amber-100'; iconColor = 'text-amber-600'; }
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.3, type: "spring" }}>
      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${bgColor}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
    </motion.div>
  );
}