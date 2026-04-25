import { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:5001";

export const useFiles = (roomId: string) => {
  const [files, setFiles] = useState<Record<string, string>>({});
  const pollRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Fetch function
    const fetch$ = async () => {
      try {
        const res = await fetch(`${API_URL}/api/files/${roomId}`);
        const data = await res.json();

        const contentOnly: Record<string, string> = {};
        Object.entries(data).forEach(([filename, file]: [string, any]) => {
          contentOnly[filename] = file.content || file;
        });
        setFiles(contentOnly);
      } catch (err) {
        console.error("Failed to fetch files:", err);
      }
    };

    // Fetch immediately on mount
    fetch$();

    // Poll every 500ms (like chat)
    pollRef.current = setInterval(fetch$, 500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [roomId]);

  // Save file (like sendMessage in chat)
  const saveFile = async (filename: string, content: string) => {
    try {
      await fetch(`${API_URL}/api/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, filename, content }),
      });
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  };

  return { files, saveFile };
};
