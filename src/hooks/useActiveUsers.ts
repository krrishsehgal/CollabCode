import { useState, useEffect, useCallback, useRef } from "react";

export interface ActiveUser {
  userId: string;
  displayName: string;
}

const API_URL = "http://localhost:5001";

export const useActiveUsers = (roomId: string) => {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  // Fetch active users from backend
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/${roomId}`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, [roomId]);

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, [roomId, fetchUsers]);

  // Poll for updates every 1 second
  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchUsers, 1000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchUsers]);

  return { users };
};
