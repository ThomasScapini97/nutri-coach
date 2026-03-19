import { useEffect } from "react";
import { toast } from "sonner";

export function useMealReminderCheck(lastLogTime) {
  useEffect(() => {
    if (!lastLogTime) return;
    const checkInterval = setInterval(() => {
      const now = new Date();
      const hoursSinceLastLog = (now - new Date(lastLogTime)) / (1000 * 60 * 60);
      const currentHour = now.getHours();
      if (hoursSinceLastLog > 4 && currentHour >= 8 && currentHour <= 20) {
        toast("Don't forget to log your meals 🍽️", { description: "Keep track of your nutrition by logging what you eat today.", duration: 5000 });
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(checkInterval);
  }, [lastLogTime]);
}