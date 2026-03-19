import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary (little exercise)" },
  { value: "light", label: "Light (1-3 days/week)" },
  { value: "moderate", label: "Moderate (3-5 days/week)" },
  { value: "active", label: "Active (6-7 days/week)" },
  { value: "very_active", label: "Very Active (intense daily)" },
];

const GOALS = [
  { value: "lose_weight", label: "Lose weight", emoji: "🎯" },
  { value: "maintain", label: "Maintain weight", emoji: "⚖️" },
  { value: "gain_muscle", label: "Gain muscle", emoji: "💪" },
];

function calculateCalorieGoal(profile) {
  if (!profile.weight || !profile.height || !profile.age || !profile.gender) return 2000;
  let bmr;
  if (profile.gender === "male") {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  } else {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  }
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  let tdee = bmr * (multipliers[profile.activity_level] || 1.2);
  if (profile.goal === "lose_weight") tdee = tdee * 0.8;
  if (profile.goal === "gain_muscle") tdee += 300;
  return Math.round(tdee);
}

export default function Onboarding({ onComplete }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    age: "", weight: "", height: "", gender: "", activity_level: "", goal: "",
  });

  const age = Number(form.age);
  const weight = Number(form.weight);
  const height = Number(form.height);

  const ageValid = form.age !== "" && age >= 10 && age <= 100;
  const weightValid = form.weight !== "" && weight >= 30 && weight <= 250;
  const heightValid = form.height !== "" && height >= 120 && height <= 230;

  const ageError = form.age !== "" && !ageValid;
  const weightError = form.weight !== "" && !weightValid;
  const heightError = form.height !== "" && !heightValid;

  const isValid = ageValid && weightValid && heightValid && form.gender && form.activity_level && form.goal;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);

    const calorieGoal = calculateCalorieGoal({
      ...form,
      weight: Number(form.weight),
      height: Number(form.height),
      age: Number(form.age),
    });
    const proteinGoal = form.goal === "gain_muscle"
      ? Math.round(Number(form.weight) * 2)
      : Math.round(Number(form.weight) * 1.5);
    const fatsGoal = Math.round((calorieGoal * 0.25) / 9);
    const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatsGoal * 9) / 4);

    const { error } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      age: Number(form.age),
      weight: Number(form.weight),
      height: Number(form.height),
      gender: form.gender,
      activity_level: form.activity_level,
      goal: form.goal,
      calorie_goal: calorieGoal,
      protein_goal: proteinGoal,
      fats_goal: fatsGoal,
      carbs_goal: carbsGoal,
    }, { onConflict: 'user_id' });

    if (error) {
      toast.error("Error saving profile");
      setSaving(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    setSaving(false);
    toast.success("Profile saved! 🎉", { description: `Your daily goal: ${calorieGoal} kcal.`, duration: 3000 });
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to NutriCoach</h1>
          <p className="text-muted-foreground">Let's set up your profile to personalize your nutrition goals.</p>
        </div>
        <Card className="shadow-lg border-border/50">
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-medium">Age</Label>
                <Input type="number" min="10" max="100" placeholder="25" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className={`rounded-xl border-2 h-11 ${ageError ? "border-red-500 bg-red-50" : ""}`} />
                {ageError && <p className="text-xs text-red-500">Age must be between 10 and 100</p>}
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Biological Sex</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger className="rounded-xl border-2 h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-medium">Weight (kg)</Label>
                <Input type="number" min="30" max="250" placeholder="70" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={`rounded-xl border-2 h-11 ${weightError ? "border-red-500 bg-red-50" : ""}`} />
                {weightError && <p className="text-xs text-red-500">Weight must be between 30 and 250 kg</p>}
              </div>
              <div className="space-y-1">
                <Label className="font-medium">Height (cm)</Label>
                <Input type="number" min="120" max="230" placeholder="175" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} className={`rounded-xl border-2 h-11 ${heightError ? "border-red-500 bg-red-50" : ""}`} />
                {heightError && <p className="text-xs text-red-500">Height must be between 120 and 230 cm</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Activity Level</Label>
              <Select value={form.activity_level} onValueChange={(v) => setForm({ ...form, activity_level: v })}>
                <SelectTrigger className="rounded-xl border-2 h-11"><SelectValue placeholder="Select activity level" /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Wellness Goal</Label>
              <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v })}>
                <SelectTrigger className="rounded-xl border-2 h-11"><SelectValue placeholder="Select your goal" /></SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.emoji} {g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving || !isValid} className="w-full h-12 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90 shadow-md mt-2">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
              {saving ? "Saving..." : "Get Started"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}