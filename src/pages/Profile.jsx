import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, User, Activity, Target, Sparkles, LogOut, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
  if (profile.goal === "lose_weight") tdee -= 400;
  if (profile.goal === "gain_muscle") tdee += 300;
  return Math.round(tdee);
}

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ age: "", weight: "", height: "", gender: "", activity_level: "", goal: "" });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        age: profile.age || "",
        weight: profile.weight || "",
        height: profile.height || "",
        gender: profile.gender || "",
        activity_level: profile.activity_level || "",
        goal: profile.goal || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    const calorieGoal = calculateCalorieGoal({ ...form, weight: Number(form.weight), height: Number(form.height), age: Number(form.age) });
    const proteinGoal = form.goal === "gain_muscle" ? Math.round(Number(form.weight) * 2) : Math.round(Number(form.weight) * 1.5);
    const fatsGoal = Math.round((calorieGoal * 0.25) / 9);
    const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatsGoal * 9) / 4);

    await supabase.from('user_profiles').upsert({
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

    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    setSaving(false);
    toast.success("Profile saved! 🎉", { description: `Your daily calorie goal is ${calorieGoal} kcal.`, duration: 3000 });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: logs } = await supabase.from('food_logs').select('id').eq('user_id', user.id);
      if (logs?.length > 0) {
        const logIds = logs.map(l => l.id);
        await supabase.from('food_entries').delete().in('foodlog_id', logIds);
        await supabase.from('messages').delete().in('foodlog_id', logIds);
        await supabase.from('food_logs').delete().eq('user_id', user.id);
      }
      await supabase.from('user_profiles').delete().eq('user_id', user.id);
      await supabase.auth.signOut();
    } catch (error) {
      toast.error("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  const ageValid = Number(form.age) >= 10 && Number(form.age) <= 100;
  const weightValid = Number(form.weight) >= 30 && Number(form.weight) <= 250;
  const heightValid = Number(form.height) >= 120 && Number(form.height) <= 230;
  const formValid = ageValid && weightValid && heightValid;
  const previewGoal = formValid ? calculateCalorieGoal({ ...form, weight: Number(form.weight), height: Number(form.height), age: Number(form.age) }) : null;

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-2">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Your Profile</h2>
          <p className="text-muted-foreground">Let's personalize your wellness journey</p>
          {user?.email && <p className="text-sm text-muted-foreground mt-2">Logged in as <span className="font-medium text-foreground">{user.email}</span></p>}
        </motion.div>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Age</Label>
                <Input type="number" placeholder="25" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="rounded-xl border-2 h-11" />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Gender</Label>
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
              <div className="space-y-2">
                <Label className="font-medium">Weight (kg)</Label>
                <Input type="number" placeholder="70" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="rounded-xl border-2 h-11" />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Height (cm)</Label>
                <Input type="number" placeholder="175" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} className="rounded-xl border-2 h-11" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Activity className="w-4 h-4 text-primary" /></div>
              Activity & Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">Activity Level</Label>
              <Select value={form.activity_level} onValueChange={(v) => setForm({ ...form, activity_level: v })}>
                <SelectTrigger className="rounded-xl border-2 h-11"><SelectValue placeholder="Select activity level" /></SelectTrigger>
                <SelectContent>{ACTIVITY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Wellness Goal</Label>
              <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v })}>
                <SelectTrigger className="rounded-xl border-2 h-11"><SelectValue placeholder="Select your goal" /></SelectTrigger>
                <SelectContent>{GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.emoji} {g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {formValid && form.gender && (
          <Card className="border-none shadow-lg bg-gradient-to-br from-primary to-primary/90 text-white">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">Your Daily Goal</p>
                  <p className="text-4xl font-bold">{previewGoal}</p>
                  <p className="text-white/70 text-sm mt-1">calories per day</p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Target className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button onClick={handleSave} disabled={saving || !formValid} className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90 shadow-md">
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Save Profile
        </Button>

        <div className="space-y-3 pb-2">
          <Button variant="outline" onClick={handleLogout} className="w-full h-12 text-base font-semibold rounded-2xl border-2">
            <LogOut className="w-5 h-5 mr-2" /> Log Out
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full h-12 text-base font-semibold rounded-2xl text-destructive hover:bg-destructive/10">
                <Trash2 className="w-5 h-5 mr-2" /> Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete all your data. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}