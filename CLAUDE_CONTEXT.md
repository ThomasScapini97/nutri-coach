# NutriCoach AI — Project Context

## Stack & Deploy
- React + Vite + Tailwind + shadcn/ui
- Supabase (auth, database, RLS)
- Anthropic API (claude-haiku-4-5-20251001) via Vercel Function
- Deploy: Vercel — `git add . && git commit -m "msg" && git push`
- URL: https://nutri-coach-ashy.vercel.app
- GitHub: https://github.com/ThomasScapini97/nutri-coach
- Local: `C:\Users\ASUS\Desktop\nutri-coach`

## Vercel Env Vars
- ANTHROPIC_API_KEY
- SUPABASE_URL=https://czkcizvpkvrbzhhgtyho.supabase.co
- SUPABASE_SERVICE_ROLE_KEY

## Database (Supabase) — All tables have RLS enabled

### user_profiles
age, weight, height, gender, activity_level, goal, chat_style,
active_days_goal, burn_goal, weight_goal, calorie_goal, protein_goal,
carbs_goal, fats_goal, display_name, water_glasses

### food_logs
date, user_id, total_calories, total_carbs, total_protein, total_fats,
total_fiber, total_burned_calories, water_glasses

### food_entries
foodlog_id, food_name, food_key, meal_type, calories, carbs, protein,
fats, fiber, timestamp, grams (float4 — quantity in grams)

### messages
foodlog_id, role (user/assistant/system), content, timestamp, nutrition

### exercise_logs
user_id, foodlog_id, date, exercise_name, duration_minutes,
calories_burned, created_at

### diary_entries
user_id, date, mood, energy, sleep_quality, stress, notes, weight,
waist, hips, chest, arm, thigh, created_at. UNIQUE(user_id, date)

### rate_limits
user_id, date, message_count. UNIQUE(user_id, date) — limit: 50 msg/day
Atomic increment via Postgres RPC function `increment_rate_limit(p_user_id, p_date)`

### daily_summaries
user_id, date (text), summary_text (text), calories (int), protein (float4),
carbs (float4), fats (float4), burned_calories (int), weight (float4),
created_at. UNIQUE(user_id, date)
Used for chat memory between days (last 7 days injected into system prompt)

## File Structure
src/
├── pages/
│   ├── Chat.jsx          — main chat, AI integration, streak pill, daily summaries
│   ├── Summary.jsx       — food log summary, editable grams, trend chart
│   ├── Exercise.jsx      — exercise tracking, burn goal, date navigator
│   ├── Diary.jsx         — weight tracking with progress bar, wellness, chart
│   ├── Profile.jsx       — user settings, goals, delete account
│   └── Onboarding.jsx    — 6-step onboarding flow
├── components/
│   ├── chat/
│   │   ├── ChatBubble.jsx         — WhatsApp style; role:system = grey pill with ReactMarkdown
│   │   ├── ChatInput.jsx          — input + barcode scanner button
│   │   ├── BarcodeScanner.jsx     — @zxing/library, Open Food Facts lookup
│   │   ├── NutritionCard.jsx      — meal card shown after logging; groups same food as "uovo x2"
│   │   ├── DailyDashboard.jsx     — collapsible (default closed), always shows water tracker
│   │   └── TypingIndicator.jsx    — animated dots
│   ├── summary/
│   │   ├── FoodEntryItem.jsx      — shows grams (editable pill), kcal, +/- controls
│   │   ├── AnimatedProgressBar.jsx — compact macro bar (icon + label + thin bar, matches DailyDashboard style)
│   │   └── ScrollableChart.jsx    — 90-day scrollable calendar with colored dots, uses net calories
│   ├── exercise/
│   │   └── ScrollableExerciseChart.jsx
│   ├── layout/
│   │   ├── AppLayout.jsx          — avatar top-left (fixed), back arrow in /Profile, hides nav in /Profile
│   │   └── MobileNav.jsx          — 4 tabs: Chat | Summary | Exercise | Diary
│   └── notifications/
│       ├── DailyNotificationPopup.jsx  — evening popup at 21:00, dismissable
│       ├── DailyEvaluation.js
│       └── MealReminderToast.js        — max 1 toast per 4 hours
├── lib/
│   ├── supabase.js
│   ├── AuthContext.jsx
│   ├── nutritionUtils.js   — recalculateTotals, FIBER_GOAL, getToday()
│   ├── constants.js        — WATER_GOAL, AI_MAX_TOKENS, CHAT_HISTORY_LIMIT,
│   │                          STREAK_LOOKBACK_DAYS, MEMORY_DAYS
│   └── dailySummary.js     — generateDailySummary(), loadPastSummaries()
api/
├── chat.js           — Vercel Function: auth, rate limiting, OFF lookup, Anthropic proxy
└── delete-account.js — deletes all user data + auth.admin.deleteUser()

## Key Implementation Details

### Chat.jsx
- `getToday()` imported from nutritionUtils (not defined locally)
- `buildSystemPrompt()` is memoized with useMemo([profile, todayLog, foodEntries, pastSummaries])
- Auto-reload at midnight via useEffect setTimeout
- Streak pill in header: shows 🔥N when streak≥1, 👑🔥N when ≥7, 🏆🔥N when ≥30
- Streak calculated from food_logs where date matches created_at local date (prevents retroactive gaming)
- Past 7 daily summaries injected into system prompt for AI memory
- Yesterday's summary auto-generated on mount if missing
- evaluationDismissed state prevents popup reopening after close
- Sends grams field to food_entries
- System prompt includes Open Food Facts nutrition data when available
- Rate limit 429 handled with toast
- No calorie/macro caps on food entries (removed)

### api/chat.js
- Vercel Function proxy for Anthropic API
- Verifies Supabase Bearer token
- Rate limiting: 50 msg/day via atomic Postgres RPC (avoids race condition)
- Open Food Facts integration for nutrition lookup (per message)
- Error responses from Anthropic are sanitized — full error logged server-side only
- Model whitelist: only claude-haiku-4-5-20251001 allowed

### Summary.jsx
- `getToday()` imported from nutritionUtils
- Food entry grouping is memoized with useMemo([dayEntries])
- Grouped by normalized food_name + meal_type key
- isPast days: editing fully enabled (no read-only restrictions)
- handleUpdateGrams: proportional recalculation of all macros when grams edited
- Inserts role:'system' message in messages table on gram update

### Exercise.jsx
- `getToday()` imported from nutritionUtils
- isPast restrictions removed — all days fully editable
- Duplicate workout detection: fresh DB query + canonical exercise signature
- Preset buttons use setSavingPreset(id) — only clicked button greys out
- Saved Workouts always visible; empty state when no presets

### DailyDashboard.jsx
- WATER_GOAL imported from constants.js
- Default: expanded=false (closed)
- Always visible: header (calories + burned), calorie bar, water tracker
- Macros grid only shown when expanded=true
- Flame icon (Lucide) in header, no emoji
- Burns calories shown as orange text line when >0

### FoodEntryItem.jsx
- Grams shown as clickable white pill with dashed green border
- Click → inline input; Enter/blur confirms, Escape cancels

### NutritionCard.jsx
- Groups same food_name within a meal as "uovo x2"
- Falls back to embedded nutrition.foods data if entry_id is missing (old messages)

### ChatBubble.jsx
- role='system' → grey centered pill, content rendered with ReactMarkdown
- role='assistant' → white bubble, ReactMarkdown
- role='user' → green bubble (#dcf8c6)

### Diary.jsx
- `getToday()` imported from nutritionUtils
- startWeight from user_profiles.weight (onboarding weight)
- Weight progress bar: clamped 0-100, never negative

### AppLayout.jsx
- Avatar: position fixed, top:14px, left:16px, zIndex:100
- Shows back arrow when pathname==='/Profile'
- MobileNav hidden in /Profile

### Calorie Formula (Onboarding + Profile)
- Mifflin-St Jeor BMR + activity multiplier = TDEE
- lose_weight: tdee * 0.80, floor 1200 (women) / 1500 (men)
- gain_muscle: tdee + 350
- maintain: tdee

### Security
- All fetch queries use .maybeSingle() instead of .single() for optional data
- Anthropic errors sanitized before sending to client
- Rate limiting atomic via Postgres RPC

## Design System
- Primary green: #16a34a / #15803d
- Background: #f0fcf3 (bg-mint)
- Border: 0.5px solid rgba(0,0,0,0.06)
- Border radius cards: 16-20px
- Font sizes: 9px-16px (very compact mobile-first)
- Shadows: 0 1px 4px rgba(0,0,0,0.06)

## Current Known Issues / TODO
- [ ] Barcode scanner: needs real iPhone testing with physical products
- [ ] Capacitor conversion for iOS/Android (needs Mac)
- [ ] Privacy policy & terms of service (required for App Store)
- [ ] App icons and store screenshots
- [ ] Push notifications (after Capacitor)
- [ ] User-configurable evening notification time
- [ ] CSV data export
- [ ] System messages (grey pill) for +/- quantity and delete actions in Summary

## Scores
- Pre-pubblicazione: 75/100
- Come prodotto MVP: 80/100
- Pronto App Store: No (mancano ~2-3 settimane)
