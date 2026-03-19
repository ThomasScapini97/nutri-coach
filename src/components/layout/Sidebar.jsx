import { Link, useLocation } from "react-router-dom";
import { MessageCircle, BarChart3, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/Chat", label: "Chat", icon: MessageCircle },
  { path: "/Summary", label: "Summary", icon: BarChart3 },
  { path: "/Profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  const location = useLocation();
  return (
    <aside className="hidden md:flex flex-col w-72 bg-white border-r border-border/50 h-screen sticky top-0">
      <div className="p-6 border-b border-border/50">
        <Link to="/Chat" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-xl leading-tight">NutriCoach</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your wellness companion</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={cn("flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200", isActive ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-md" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-5 m-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
        <p className="text-xs text-foreground leading-relaxed">💚 Tell me what you ate today and I'll help you reach your wellness goals!</p>
      </div>
    </aside>
  );
}