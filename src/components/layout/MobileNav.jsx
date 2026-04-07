import { Link, useLocation } from "react-router-dom";
import { MessageCircle, BarChart3, Dumbbell, BookOpen } from "lucide-react";

const navItems = [
  { path: "/Chat", label: "Chat", icon: MessageCircle },
  { path: "/Summary", label: "Summary", icon: BarChart3 },
  { path: "/Exercise", label: "Exercise", icon: Dumbbell },
  { path: "/Diary", label: "Diary", icon: BookOpen },
];

export default function MobileNav() {
  const location = useLocation();
  return (
    <nav
      className="md:hidden fixed z-50"
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        left: "16px",
        right: "16px",
        height: "56px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "999px",
        border: "0.5px solid rgba(0,0,0,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
      }}
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            style={{
              color: isActive ? "#16a34a" : "#9ca3af",
              textDecoration: "none",
              fontSize: "10px",
              fontWeight: 500,
              transition: "color 0.15s",
            }}
          >
            <item.icon
              style={{
                width: "20px",
                height: "20px",
                strokeWidth: isActive ? 2.5 : 2,
              }}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
