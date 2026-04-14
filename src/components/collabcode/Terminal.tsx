import { ChevronDown, ChevronUp, Terminal as TermIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const mockOutput = [
  { type: "info", text: "$ npm run dev" },
  { type: "info", text: "" },
  { type: "success", text: "  VITE v5.4.19  ready in 312 ms" },
  { type: "info", text: "" },
  { type: "info", text: "  ➜  Local:   http://localhost:5173/" },
  { type: "info", text: "  ➜  Network: http://192.168.1.12:5173/" },
  { type: "info", text: "" },
  { type: "warn", text: "[TypeScript] Found 0 errors. Watching for file changes." },
  { type: "success", text: "✓ WebSocket connected to collaboration server" },
  { type: "info", text: "✓ 3 users in room ab7x-k92m" },
];

const typeColors: Record<string, string> = {
  info: "text-secondary-foreground",
  success: "text-neon-green",
  warn: "text-yellow-400",
  error: "text-destructive",
};

const TerminalPanel = ({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) => {
  return (
    <div className="border-t border-glass-border">
      <button
        onClick={onToggle}
        className="w-full h-8 px-4 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <TermIcon className="w-3.5 h-3.5" />
          <span className="font-medium">Terminal</span>
        </div>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 180 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="h-[180px] bg-background overflow-y-auto scrollbar-thin p-3 font-mono text-xs leading-5">
              {mockOutput.map((line, i) => (
                <div key={i} className={typeColors[line.type]}>
                  {line.text || "\u00A0"}
                </div>
              ))}
              <div className="flex items-center gap-1 mt-1">
                <span className="text-neon-purple">❯</span>
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="w-2 h-4 bg-foreground inline-block"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalPanel;
