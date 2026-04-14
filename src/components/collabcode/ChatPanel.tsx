import { Send } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface ChatMessage {
  user: string;
  text: string;
  time: string;
  color: string;
  isSystem?: boolean;
}

const mockMessages: ChatMessage[] = [
  { user: "System", text: "Sarah K. joined the room", time: "2:30 PM", color: "text-muted-foreground", isSystem: true },
  { user: "Alex M.", text: "Hey! Working on the WebSocket handler 🔧", time: "2:31 PM", color: "text-neon-blue" },
  { user: "Sarah K.", text: "Nice, I'll handle the UI components", time: "2:32 PM", color: "text-neon-pink" },
  { user: "You", text: "Sounds good! Let me set up the types", time: "2:33 PM", color: "text-neon-purple" },
  { user: "System", text: "Jordan L. joined the room", time: "2:35 PM", color: "text-muted-foreground", isSystem: true },
  { user: "Jordan L.", text: "Hey team 👋", time: "2:35 PM", color: "text-neon-green" },
];

const ChatPanel = () => {
  const [message, setMessage] = useState("");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-glass-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {mockMessages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            {msg.isSystem ? (
              <div className="text-[11px] text-muted-foreground text-center py-1">
                {msg.text}
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-medium ${msg.color}`}>{msg.user}</span>
                  <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                </div>
                <p className="text-sm text-secondary-foreground mt-0.5">{msg.text}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="p-3 border-t border-glass-border">
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-8 bg-secondary rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-purple to-neon-blue flex items-center justify-center text-primary-foreground"
          >
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
