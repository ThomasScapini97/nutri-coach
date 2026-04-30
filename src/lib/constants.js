// Centralised app constants — change here, updates everywhere

// Water tracking
export const WATER_GOAL = 8; // glasses per day

// AI / Chat
export const AI_MAX_TOKENS = 3000;
export const CHAT_HISTORY_LIMIT = 10; // messages sent as context to AI

// Daily summaries (memory)
export const MEMORY_DAYS = 7; // how many past daily summaries to inject into system prompt

// Weekly challenge targets — shared between WeeklyChallenges.jsx and weeklyScores.js
export const CHALLENGE_TARGETS = {
  log: 5,       // food-logging days
  hydration: 5, // days hitting water goal
  protein: 4,   // days hitting protein goal
  calories: 4,  // days within calorie tolerance
  exercise: 3,  // distinct exercise days
  diary: 4,     // diary entries with mood
};
export const CALORIES_TOLERANCE = 150; // ±kcal from goal counts as "on target"
