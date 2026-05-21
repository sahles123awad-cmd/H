import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setVisible(false), 2000);
    const doneTimer = setTimeout(() => onDone(), 2550);
    return () => { clearTimeout(hideTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "#FF6B00",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100dvh",
          }}
        >
          <motion.div
            initial={{ scale: 0.25, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.05 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}
          >
            <motion.img
              src="/logo-clean.png"
              alt="يلا وصل"
              style={{ width: 160, height: 160, objectFit: "contain" }}
              animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
              transition={{ delay: 0.55, duration: 0.7, ease: "easeInOut" }}
            />
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.35 }}
              style={{
                color: "#fff",
                fontSize: "1.2rem",
                fontWeight: 800,
                fontFamily: "'Tajawal', sans-serif",
                textShadow: "0 2px 8px rgba(0,0,0,0.18)",
                margin: 0,
              }}
            >
              يلا وصل
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
