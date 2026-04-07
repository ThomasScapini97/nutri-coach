import { useState, useRef, useEffect } from "react";
import { Send, ScanLine, Camera, Plus, Mic } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage } from "@/lib/imageUtils";

export default function ChatInput({ onSend, isLoading, onScannerOpen, onPhotoSend }) {
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    onSend(message.trim());
    setMessage("");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setMenuOpen(false);
    setCompressing(true);
    try {
      const base64 = await compressImage(file);
      onPhotoSend(base64);
    } catch {
      // silent fail
    } finally {
      setCompressing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return; // browser not supported — button simply won't work

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "it-IT";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    finalTranscriptRef.current = message; // preserve existing text

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (e) => {
      let interim = "";
      let final = finalTranscriptRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += (final ? " " : "") + t;
          finalTranscriptRef.current = final;
        } else {
          interim = t;
        }
      }
      setMessage(final + (interim ? " " + interim : ""));
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const menuItems = [
    {
      icon: <Camera className="w-5 h-5 text-purple-500" />,
      label: "Foto",
      bg: "#f3e8ff",
      action: () => { setMenuOpen(false); fileInputRef.current?.click(); },
    },
    {
      icon: <ScanLine className="w-5 h-5 text-green-600" />,
      label: "Scanner",
      bg: "#f0fcf3",
      action: () => { setMenuOpen(false); onScannerOpen(); },
    },
  ];

  const showSend = message.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 pt-2 pb-3 bg-white border-t border-gray-200 fixed bottom-20 left-0 right-0 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto"
    >
      {/* Hidden camera input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="max-w-4xl mx-auto flex items-center gap-2">
        {/* + button with popup menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "transparent",
              border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {compressing
              ? <Spinner size="sm" />
              : <Plus style={{ width: "24px", height: "24px", color: "#4b5563", transition: "transform 0.2s", transform: menuOpen ? "rotate(45deg)" : "rotate(0deg)" }} />
            }
          </button>

          {/* Popup menu */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  bottom: "60px",
                  left: 0,
                  background: "white",
                  borderRadius: "16px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                  border: "0.5px solid rgba(0,0,0,0.06)",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  minWidth: "130px",
                  zIndex: 50,
                }}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "9px 12px", borderRadius: "10px",
                      border: "none", background: "transparent",
                      cursor: "pointer", fontSize: "13px",
                      fontWeight: 500, color: "#111827",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
          placeholder=""
          rows={1}
          className="flex-1 resize-none rounded-full border border-gray-200 bg-white px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all min-h-[38px] max-h-32 shadow-sm"
          style={{ fontSize: "15px", lineHeight: "1.5" }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {showSend ? (
            <motion.button
              key="send"
              type="submit"
              disabled={isLoading}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                width: "38px", height: "38px", borderRadius: "50%",
                background: "#16a34a", border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(22,163,74,0.35)",
              }}
            >
              {isLoading ? <Spinner size="sm" /> : <Send style={{ width: "16px", height: "16px", color: "white" }} />}
            </motion.button>
          ) : (
            <motion.div
              key="mic"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isLoading}
                style={{
                  width: "38px", height: "38px", borderRadius: "50%",
                  border: "none", cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isRecording ? "#ef4444" : "transparent",
                  transition: "background 0.2s",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {isRecording && (
                  <span style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "#ef4444", opacity: 0.35,
                    animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
                  }} />
                )}
                <Mic style={{
                  width: "22px", height: "22px",
                  color: isRecording ? "white" : "#4b5563",
                  position: "relative",
                }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </form>
  );
}
