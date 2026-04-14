import { Code2, LogOut, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const [isDark, setIsDark] = useState(true);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <nav className="h-14 glass border-b border-glass-border flex items-center justify-between px-5 z-50">
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.4 }}
          className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center neon-glow-purple"
        >
          <Code2 className="w-4 h-4 text-primary-foreground" />
        </motion.div>
        <h1 className="text-lg font-semibold gradient-text">CollabCode</h1>
      </div>

      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsDark(!isDark)}
          className="w-9 h-9 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </motion.button>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-pink to-neon-purple ring-2 ring-neon-purple/30" />

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLogout}
          className="w-9 h-9 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </motion.button>
      </div>
    </nav>
  );
};

export default Navbar;
