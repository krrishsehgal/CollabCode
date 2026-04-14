import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

const notifications = [
  { text: "Jordan L. joined the room", delay: 2000 },
  { text: "Sarah K. is editing Header.tsx", delay: 5000 },
];

const NotificationToast = () => {
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    notifications.forEach(({ text, delay }) => {
      const showTimer = setTimeout(() => setVisible(text), delay);
      const hideTimer = setTimeout(() => setVisible(null), delay + 3000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    });
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -20, x: "-50%" }}
          className="fixed top-20 left-1/2 z-50 glass rounded-xl px-4 py-2.5 flex items-center gap-2 neon-glow-purple"
        >
          <UserPlus className="w-4 h-4 text-neon-purple" />
          <span className="text-sm text-foreground">{visible}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast;
