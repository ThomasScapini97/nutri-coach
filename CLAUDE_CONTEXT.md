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
fats, fiber, timestamp, grams (float4 — quantity in grams, added recently)

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

## File Structure
src/
├── pages/
│   ├── Chat.jsx          — main chat, AI integration, barcode scanner
│   ├── Summary.jsx       — food log summary, editable grams, trend chart
│   ├── Exercise.jsx      — exercise tracking, burn goal, date navigator
│   ├── Diary.jsx         — weight tracking with progress bar, wellness, chart
│   ├── Profile.jsx       — user settings, goals, delete account
│   └── Onboarding.jsx    — 6-step onboarding flow
├── components/
│   ├── chat/
│   │   ├── ChatBubble.jsx         — WhatsApp style, handles role:system (grey centered pill)
│   │   ├── ChatInput.jsx          — input + barcode scanner button
│   │   ├── BarcodeScanner.jsx     — @zxing/library, Open Food Facts lookup
│   │   ├── DailyDashboard.jsx     — collapsible (default closed), always shows water tracker
│   │   └── TypingIndicator.jsx    — animated dots
│   ├── summary/
│   │   ├── FoodEntryItem.jsx      — shows grams (editable pill), kcal, +/- controls
│   │   ├── AnimatedProgressBar.jsx
│   │   └── ScrollableChart.jsx    — 90-day scrollable calendar with colored dots
│   ├── exercise/
│   │   └── ScrollableExerciseChart.jsx
│   ├── layout/
│   │   ├── AppLayout.jsx          — avatar top-left (fixed), back arrow in /Profile, hides nav in /Profile
│   │   └── MobileNav.jsx          — 4 tabs: Chat | Summary | Exercise | Diary
│   └── notifications/
│       ├── DailyNotificationPopup.jsx  — evening popup at 21:00, dismissable (evaluationDismissed state)
│       ├── DailyEvaluation.js
│       └── MealReminderToast.js
api/
└── chat.js   — Vercel Function: auth check, rate limiting, Open Food Facts lookup, Anthropic API proxy

## Key Implementation Details

### Chat.jsx
- TODAY replaced with getToday() = () => format(new Date(), "yyyy-MM-dd") to avoid midnight bug
- Auto-reload at midnight via useEffect setTimeout
- evaluationDismissed state prevents popup reopening after close
- Sends grams field to food_entries
- System prompt includes Open Food Facts nutrition data when available
- Rate limit 429 handled with toast

### api/chat.js
- Vercel Function proxy for Anthropic API
- Verifies Supabase Bearer token
- Rate limiting: 50 msg/day via rate_limits table (uses .maybeSingle())
- Open Food Facts integration:
  1. Extracts food names from user message via quick Haiku call (max 300 tokens)
  2. Fetches nutrition per 100g from OFF API in parallel (3s timeout)
  3. Appends real nutrition data to system prompt before main AI call
  4. Falls back to hardcoded values if OFF returns nothing

### Summary.jsx
- handleUpdateGrams: proportional recalculation of all macros when grams edited
- Inserts role:'system' message in messages table on gram update
- isPast days: read-only overlay on "What you ate", darker hero card
- onUpdateGrams passed to FoodEntryItem only when !isPast

### FoodEntryItem.jsx
- Grams shown as clickable white pill with dashed green border
- Click → inline input (green border, f0fdf4 bg)
- Enter/blur confirms, Escape cancels
- onUpdateGrams prop: if undefined → read-only (past days)

### DailyDashboard.jsx
- Default: expanded=false (closed)
- Always visible: header (calories), calorie bar, water tracker
- Water tracker always visible (outside AnimatePresence)
- Macros grid only shown when expanded=true
- "View full summary" link removed (redundant with bottom nav)

### Diary.jsx
- startWeight from user_profiles.weight (onboarding weight)
- Weight progress bar formula:
  - losing: raw = ((start - current) / (start - goal)) * 100
  - gaining: raw = ((current - start) / (goal - start)) * 100
  - clamped 0-100, never negative when going wrong direction
- Progress bar color: always #22c55e, #16a34a when goal reached

### ChatBubble.jsx
- role='system' → grey centered pill (no timestamp, no bubble)
- role='assistant' → white bubble, ReactMarkdown
- role='user' → green bubble (#dcf8c6)
- looksLikeJson guard: shows error message if content is raw JSON

### AppLayout.jsx
- Avatar: position fixed, top:14px, left:16px, zIndex:100
- Shows back arrow when pathname==='/Profile'
- MobileNav hidden in /Profile

## Current Known Issues / TODO
- [ ] Top bar "NutriCoach" in Chat.jsx needs to be re-added (removed then decided to keep)
- [ ] Avatar overlaps DailyDashboard when top bar is missing
- [ ] System messages (grey pill) should also appear for +/- quantity and delete actions in Summary
- [ ] Barcode scanner: needs real iPhone testing with physical products
- [ ] Capacitor conversion for iOS/Android (needs Mac)
- [ ] Privacy policy & terms of service (required for App Store)
- [ ] App icons and store screenshots
- [ ] Push notifications (after Capacitor)
- [ ] Chat memory between days (premium feature)
- [ ] User-configurable evening notification time
- [ ] CSV data export

## Design System
- Primary green: #16a34a / #15803d
- Background: #f0fcf3
- Border: 0.5px solid rgba(0,0,0,0.06)
- Border radius cards: 16-20px
- Font sizes: 9px-16px (very compact mobile-first)
- Shadows: 0 1px 4px rgba(0,0,0,0.06)
- All pages: date navigator full-width at top, content scrollable, chart/nav fixed at bottom
- Past days: read-only (opacity, pointerEvents none, lock badge)

## Scores
- Pre-pubblicazione: 75/100
- Come prodotto MVP: 80/100
- Pronto App Store: No (mancano ~2-3 settimane)
