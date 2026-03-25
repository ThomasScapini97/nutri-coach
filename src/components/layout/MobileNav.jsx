import { Link, useLocation } from "react-router-dom";
import { MessageCircle, BarChart3, User, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/Chat", label: "Chat", icon: MessageCircle },
  { path: "/Summary", label: "Summary", icon: BarChart3 },
  { path: "/Exercise", label: "Exercise", icon: Dumbbell },
  { path: "/Profile", label: "Profile", icon: User },
];

export default function MobileNav() {
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 pt-3 shadow-sm" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={cn("flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-medium transition-all duration-200", isActive ? "text-primary bg-primary/10" : "text-muted-foreground")}>
              <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}