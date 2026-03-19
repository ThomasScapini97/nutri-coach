export function evaluateDailyNutrition(todayLog, calorieGoal) {
  if (!todayLog) return null;
  const calories = todayLog.total_calories || 0;
  const percentage = (calories / calorieGoal) * 100;
  let status = 'red', title = "", message = "";
  if (percentage >= 90 && percentage <= 110) {
    status = 'green'; title = "Great job today! 🎉";
    message = "You stayed within your calorie target. Tap to see your summary.";
  } else if ((percentage >= 80 && percentage < 90) || (percentage > 110 && percentage <= 120)) {
    status = 'yellow'; title = "Good effort today!";
    message = "You were close to your calorie goal. Tap to see your summary.";
  } else {
    status = 'red'; title = "Daily Summary";
    message = percentage < 80 ? "You consumed fewer calories than recommended today." : "You exceeded your calorie goal today.";
  }
  return { status, title, message, calories, calorieGoal };
}