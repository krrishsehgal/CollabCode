import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/collabcode/Navbar";
import FileExplorer from "@/components/collabcode/FileExplorer";
import CodeEditor from "@/components/collabcode/CodeEditor";
import ActiveUsers from "@/components/collabcode/ActiveUsers";
import ChatPanel from "@/components/collabcode/ChatPanel";
import TerminalPanel from "@/components/collabcode/Terminal";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";
type ChatMessage = {
  id: string;
  clientMessageId?: string;
  roomId: string;
  userId: string;
  displayName: string;
  message: string;
  createdAt: string;
};

const Index = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const currentRoomId = roomId || "";
  const identityDisplayName = user?.identities?.find((identity) => {
    const displayName = identity.identity_data?.display_name;
    return typeof displayName === "string" && displayName.trim().length > 0;
  })?.identity_data?.display_name as string | undefined;
  const currentDisplayName =
    identityDisplayName?.trim() ||
    (typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "") ||
    (typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "") ||
    user?.email ||
    (user?.id ? user.id.slice(0, 6) : "");
  const socket = useSocket({
    roomId: currentRoomId,
    userId: user?.id,
    displayName: currentDisplayName,
  });
  const currentUserId = user?.id || "";
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState("");
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [users, setUsers] = useState<
    Array<{ userId: string; displayName: string }>
  >([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const storageKeys = {
    messages: currentRoomId ? `collabcode:${currentRoomId}:messages` : "",
    files: currentRoomId ? `collabcode:${currentRoomId}:files` : "",
  };
  const createClientMessageId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const readLocalMessages = useCallback((): ChatMessage[] => {
    if (!storageKeys.messages || typeof localStorage === "undefined") {
      return [];
    }
    try {
      const raw = localStorage.getItem(storageKeys.messages);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ChatMessage[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to read cached messages", error);
      return [];
    }
  }, [storageKeys.messages]);

  const readLocalFiles = useCallback((): Record<string, string> => {
    if (!storageKeys.files || typeof localStorage === "undefined") {
      return {};
    }
    try {
      const raw = localStorage.getItem(storageKeys.files);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.error("Failed to read cached files", error);
      return {};
    }
  }, [storageKeys.files]);

  const normalizeMessage = useCallback(
    (message: ChatMessage) => ({
      ...message,
      displayName:
        message.userId === currentUserId ? "You" : message.displayName,
    }),
    [currentUserId],
  );

  const upsertMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const matchIndex = prev.findIndex(
        (item) =>
          item.id === message.id ||
          (message.clientMessageId &&
            item.clientMessageId === message.clientMessageId),
      );
      const normalized = normalizeMessage(message);
      if (matchIndex >= 0) {
        const next = [...prev];
        next[matchIndex] = { ...next[matchIndex], ...normalized };
        next.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );
        return next;
      }
      const next = [...prev, normalized];
      next.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return next;
    });
  }, [normalizeMessage]);

  const applyCodeUpdate = useCallback((fileName: string, code: string) => {
    let nextActivity: string | null = null;
    setFiles((prev) => {
      if (prev[fileName] === code) {
        return prev;
      }
      nextActivity =
        fileName in prev
          ? `Code updated: ${fileName}`
          : `File created: ${fileName}`;
      return { ...prev, [fileName]: code };
    });
    if (nextActivity) {
      setActivity((prev) => [...prev, nextActivity]);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleFileCreated = (fileName: string) => {
      if (!fileName) return;
      setFiles((prev) =>
        fileName in prev ? prev : { ...prev, [fileName]: "" },
      );
      setActivity((prev) => [...prev, `File created: ${fileName}`]);
    };

    const handleCodeUpdate = ({
      fileName,
      code,
    }: {
      fileName: string;
      code: string;
    }) => {
      if (!fileName) return;
      applyCodeUpdate(fileName, code);
    };

    const handleUsersUpdated = ({
      users: nextUsers,
    }: {
      users: Array<{ userId: string; displayName: string }>;
    }) => {
      setUsers(nextUsers);
      setActivity((prev) => [...prev, `Users updated: ${nextUsers.length}`]);
    };

    const handleReceiveMessage = ({
      userId,
      displayName,
      message,
      clientMessageId,
    }: {
      userId: string;
      displayName: string;
      message: string;
      clientMessageId?: string;
    }) => {
      if (userId === currentUserId) {
        return;
      }
      const createdAt = new Date().toISOString();
      upsertMessage({
        id: clientMessageId ?? `${userId}-${createdAt}`,
        clientMessageId,
        roomId: currentRoomId,
        userId,
        displayName,
        message,
        createdAt,
      });
      setActivity((prev) => [...prev, `Message from ${userId}`]);
    };

    socket.on("file-created", handleFileCreated);
    socket.on("code-update", handleCodeUpdate);
    socket.on("users-updated", handleUsersUpdated);
    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("file-created", handleFileCreated);
      socket.off("code-update", handleCodeUpdate);
      socket.off("users-updated", handleUsersUpdated);
      socket.off("receive-message", handleReceiveMessage);
    };
  }, [socket, currentUserId, applyCodeUpdate, currentRoomId, upsertMessage]);

  useEffect(() => {
    if (!currentRoomId) return;
    setMessages([]);
    setFiles({});
    setOpenFiles([]);
    setActiveFile("");

    const cachedMessages = readLocalMessages();
    if (cachedMessages.length > 0) {
      setMessages(cachedMessages.map(normalizeMessage));
    }

    const cachedFiles = readLocalFiles();
    const fileNames = Object.keys(cachedFiles);
    const firstFile = fileNames[0] ?? "";
    setFiles(cachedFiles);
    setOpenFiles(firstFile ? [firstFile] : []);
    setActiveFile(firstFile);
  }, [currentRoomId, normalizeMessage, readLocalFiles, readLocalMessages]);

  useEffect(() => {
    if (!storageKeys.messages || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(storageKeys.messages, JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to cache messages", error);
    }
  }, [messages, storageKeys.messages]);

  useEffect(() => {
    if (!storageKeys.files || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(storageKeys.files, JSON.stringify(files));
    } catch (error) {
      console.error("Failed to cache files", error);
    }
  }, [files, storageKeys.files]);

  const handleSelectFile = (name: string) => {
    if (!(name in files)) return;
    setActiveFile(name);
    if (!openFiles.includes(name)) {
      setOpenFiles((prev) => [...prev, name]);
    }
  };

  const handleCreateFile = (name: string) => {
    if (!name || name in files || !currentRoomId) return;
    setFiles((prev) => ({ ...prev, [name]: "" }));
    setActiveFile(name);
    setOpenFiles((prev) => (prev.includes(name) ? prev : [...prev, name]));
    socket?.emit("file-created", {
      roomId: currentRoomId,
      fileName: name,
      userId: currentUserId,
      displayName: currentDisplayName,
    });
  };

  const handleCodeChange = (fileName: string, code: string) => {
    if (!currentRoomId) return;
    setFiles((prev) => ({ ...prev, [fileName]: code }));
    socket?.emit("code-change", {
      roomId: currentRoomId,
      fileName,
      code,
      userId: currentUserId,
      displayName: currentDisplayName,
    });
  };

  const handleCloseFile = (name: string) => {
    const newFiles = openFiles.filter((f) => f !== name);
    setOpenFiles(newFiles);
    if (activeFile === name) {
      setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1] : "");
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!currentUserId || !currentRoomId) return;
    const clientMessageId = createClientMessageId();
    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      roomId: currentRoomId,
      userId: currentUserId,
      displayName: currentDisplayName,
      message,
      createdAt: new Date().toISOString(),
    };
    upsertMessage(optimisticMessage);
    socket?.emit("send-message", {
      roomId: currentRoomId,
      userId: currentUserId,
      displayName: currentDisplayName,
      message,
      clientMessageId,
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-60 border-r border-glass-border bg-card shrink-0 overflow-hidden">
          <FileExplorer
            files={files}
            activeFile={activeFile}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
          />
        </div>

        {/* Center Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              files={files}
              openFiles={openFiles}
              activeFile={activeFile}
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
              onCodeChange={handleCodeChange}
              roomId={currentRoomId}
            />
          </div>
          <TerminalPanel
            isOpen={terminalOpen}
            onToggle={() => setTerminalOpen(!terminalOpen)}
            activity={activity}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-60 border-l border-glass-border bg-card shrink-0 flex flex-col overflow-hidden">
          <ActiveUsers users={users} currentUserId={currentUserId} />
          <ChatPanel messages={messages} onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
};

export default Index;
