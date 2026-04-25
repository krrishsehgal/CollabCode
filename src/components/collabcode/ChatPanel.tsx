import { Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { useChat } from "@/hooks/useChat";

const ChatPanel = () => {
  const { roomId } = useParams();
  const { messages, sendMessage } = useChat(roomId || "unknown");
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    await sendMessage(message);
    setMessage("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-glass-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chat</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No messages yet. Start chatting!
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={msg.id}
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
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-secondary-foreground mt-0.5">{msg.text}</p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-glass-border">
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 h-8 bg-secondary rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            className="w-8 h-8 rounded-lg bg-neon-purple flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
