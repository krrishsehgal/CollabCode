import { ChevronDown, ChevronUp, Terminal as TermIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TerminalPanel = ({
  isOpen,
  onToggle,
  activity,
}: {
  isOpen: boolean;
  onToggle: () => void;
  activity: string[];
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
              {activity.length === 0 ? (
                <div className="text-muted-foreground">No activity yet</div>
              ) : (
                activity.map((line, i) => (
                  <div key={i} className="text-secondary-foreground">
                    {line}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalPanel;
