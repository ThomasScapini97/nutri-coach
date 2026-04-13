import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, BarChart3, Dumbbell, BookOpen } from "lucide-react";
import { useChatContext } from "@/lib/ChatContext";
import ChatInput from "@/components/chat/ChatInput";
import { useTranslation } from "react-i18next";

function NavItems({ location }) {
  const { t } = useTranslation();
  const navItems = [
    { path: "/Chat", label: t("nav.chat"), icon: MessageCircle },
    { path: "/Summary", label: t("nav.summary"), icon: BarChart3 },
    { path: "/Exercise", label: t("nav.exercise"), icon: Dumbbell },
    { path: "/Diary", label: t("nav.diary"), icon: BookOpen },
  ];
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
  const [navTop, setNavTop] = useState(null);

  useEffect(() => {
    const navHeight = isChat ? 110 : 56;

    const update = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setNavTop(null);
        return;
      }
      const top = vv.offsetTop + vv.height - navHeight;
      setNavTop(Math.round(top));
    };

    const handleVVResize = () => requestAnimationFrame(update);

    window.visualViewport?.addEventListener("resize", handleVVResize);
    window.visualViewport?.addEventListener("scroll", handleVVResize);

    update();

    return () => {
      window.visualViewport?.removeEventListener("resize", handleVVResize);
      window.visualViewport?.removeEventListener("scroll", handleVVResize);
    };
  }, [isChat]);

  const safeBottom = "env(safe-area-inset-bottom, 16px)";

  const navPosition = navTop !== null
    ? { top: `${navTop}px`, bottom: "auto", paddingBottom: 0 }
    : { bottom: 0, top: "auto", paddingBottom: safeBottom };

  // ── /Chat: expanded nav with ChatInput above tab icons ──────────────────────
  if (isChat && chatInputProps) {
    return (
      <nav
        className="md:hidden"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          zIndex: 50,
          background: "white",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
          ...navPosition,
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
          <NavItems location={location} />
        </div>
      </nav>
    );
  }

  // ── Other pages: same edge-to-edge style, only icons ───────────────────────
  return (
    <nav
      className="md:hidden"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        zIndex: 50,
        background: "white",
        borderRadius: "24px 24px 0 0",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        ...navPosition,
      }}
    >
      <div style={{ display: "flex", width: "100%", height: "56px" }}>
        <NavItems location={location} />
      </div>
    </nav>
  );
}
