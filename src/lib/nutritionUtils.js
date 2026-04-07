import { supabase } from './supabase';
import { format } from 'date-fns';

export const FIBER_GOAL = 30;

export const getToday = () => format(new Date(), "yyyy-MM-dd");

export async function recalculateTotals(foodlogId) {
  const { data: entries } = await supabase
    .from('food_entries')
    .select('*')
    .eq('foodlog_id', foodlogId);

  if (!entries) return;

  const totalCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0);
  const totalCarbs = entries.reduce((sum, e) => sum + (e.carbs || 0), 0);
  const totalProtein = entries.reduce((sum, e) => sum + (e.protein || 0), 0);
  const totalFats = entries.reduce((sum, e) => sum + (e.fats || 0), 0);
  const totalFiber = entries.reduce((sum, e) => sum + (e.fiber || 0), 0);

  await supabase.from('food_logs').update({
    total_calories: totalCalories,
    total_carbs: totalCarbs,
    total_protein: totalProtein,
    total_fats: totalFats,
    total_fiber: totalFiber,
  }).eq('id', foodlogId);
}