import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DailyNotificationPopup({ evaluation, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { if (evaluation) setIsVisible(true); }, [evaluation]);

  const handleClick = () => {
    setIsVisible(false);
    setTimeout(() => { navigate("/Summary"); onClose(); }, 300);
  };

  if (!evaluation) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="relative bg-gradient-to-br from-primary to-primary/90 px-6 py-8 text-white">
                <button onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">{evaluation.title}</h3>
                </div>
              </div>
              <div className="px-6 py-6">
                <p className="text-foreground text-base leading-relaxed mb-6">{evaluation.message}</p>
                <div className="bg-muted/50 rounded-2xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Calories consumed</span>
                    <span className="text-lg font-bold">{Math.round(evaluation.calories)} / {evaluation.calorieGoal} kcal</span>
                  </div>
                </div>
                <button onClick={handleClick} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-4 rounded-2xl transition-all shadow-md">
                  View Full Summary
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}