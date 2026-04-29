import { Send } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  createdAt: string;
}

const ChatPanel = ({
  messages,
  onSendMessage,
}: {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    onSendMessage(trimmedMessage);
    setMessage("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-glass-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-xs text-muted-foreground">No messages yet</div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div>
                <p className="text-sm text-secondary-foreground mt-0.5">
                  <span className="text-xs font-medium text-neon-blue">{msg.displayName}</span>: {msg.message}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-glass-border">
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 h-8 bg-secondary rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            className="w-8 h-8 rounded-lg bg-neon-purple flex items-center justify-center text-primary-foreground"
          >
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
