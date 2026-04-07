import { Link, useLocation } from "react-router-dom";
import { MessageCircle, BarChart3, Dumbbell, BookOpen } from "lucide-react";
import { useChatContext } from "@/lib/ChatContext";
import ChatInput from "@/components/chat/ChatInput";

const navItems = [
  { path: "/Chat", label: "Chat", icon: MessageCircle },
  { path: "/Summary", label: "Summary", icon: BarChart3 },
  { path: "/Exercise", label: "Exercise", icon: Dumbbell },
  { path: "/Diary", label: "Diary", icon: BookOpen },
];

function TabIcons({ location }) {
  return (
    <>
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
            <item.icon style={{ width: "20px", height: "20px", strokeWidth: isActive ? 2.5 : 2 }} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export default function MobileNav() {
  const location = useLocation();
  const { chatInputProps } = useChatContext();
  const isChat = location.pathname === "/Chat";

  // ── /Chat: expanded nav with ChatInput above tab icons ──────────────────────
  if (isChat && chatInputProps) {
    return (
      <nav
        className="md:hidden fixed z-50 bottom-0 left-0 right-0"
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <ChatInput embedded {...chatInputProps} />
        <div
          style={{
            display: "flex",
            height: "56px",
            borderTop: "0.5px solid rgba(0,0,0,0.06)",
          }}
        >
          <TabIcons location={location} />
        </div>
      </nav>
    );
  }

  // ── Other pages: compact floating pill ──────────────────────────────────────
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
      <TabIcons location={location} />
    </nav>
  );
}
