import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatMessage {
  id: number;
  user: string;
  text: string;
  timestamp: string;
  color: string;
  isSystem?: boolean;
}

const API_URL = "http://localhost:5001";

export const useChat = (roomId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  // Fetch messages from backend
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/messages/${roomId}`);
      const data = await res.json();
      const sorted = (data as ChatMessage[]).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setMessages(sorted);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [roomId]);

  // Load messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      await fetchMessages();
      setLoading(false);
    };
    loadMessages();
  }, [roomId, fetchMessages]);

  // Poll for updates every 500ms
  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchMessages, 500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchMessages]);

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !user) return;

      const displayName = user.user_metadata?.display_name || user.email || "Anonymous";

      try {
        const res = await fetch(`${API_URL}/api/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            user: displayName,
            text: text.trim(),
            timestamp: new Date().toISOString(),
          }),
        });

        if (res.ok) {
          await fetchMessages();
        }
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    },
    [roomId, user, fetchMessages]
  );

  return { messages, loading, sendMessage };
};
