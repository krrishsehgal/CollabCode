import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/collabcode/Navbar";
import FileExplorer from "@/components/collabcode/FileExplorer";
import CodeEditor from "@/components/collabcode/CodeEditor";
import ActiveUsers from "@/components/collabcode/ActiveUsers";
import ChatPanel from "@/components/collabcode/ChatPanel";
import TerminalPanel from "@/components/collabcode/Terminal";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChatMessage,
  fetchCodeFiles,
  fetchMessages,
  saveCodeFile,
  saveMessage,
  subscribeToCodeFiles,
  subscribeToMessages,
} from "@/lib/collabPersistence";

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
  const codeSaveTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

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
      if (prev.some((item) => item.id === message.id)) {
        return prev;
      }
      const next = [...prev, normalizeMessage(message)];
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

  const scheduleCodeSave = useCallback(
    (fileName: string, code: string) => {
      if (!currentRoomId) return;
      const existingTimer = codeSaveTimers.current[fileName];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      codeSaveTimers.current[fileName] = setTimeout(() => {
        saveCodeFile({
          roomId: currentRoomId,
          fileName,
          code,
          updatedBy: currentUserId || null,
        }).catch((error) => {
          console.error("Failed to persist code file", error);
        });
      }, 750);
    },
    [currentRoomId, currentUserId],
  );

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

    socket.on("file-created", handleFileCreated);
    socket.on("code-update", handleCodeUpdate);
    socket.on("users-updated", handleUsersUpdated);

    return () => {
      socket.off("file-created", handleFileCreated);
      socket.off("code-update", handleCodeUpdate);
      socket.off("users-updated", handleUsersUpdated);
    };
  }, [socket, currentUserId, applyCodeUpdate]);

  useEffect(() => {
    if (!currentRoomId) return;
    let isActive = true;
    setMessages([]);
    setFiles({});
    setOpenFiles([]);
    setActiveFile("");

    const loadRoomState = async () => {
      try {
        const [roomMessages, roomFiles] = await Promise.all([
          fetchMessages(currentRoomId),
          fetchCodeFiles(currentRoomId),
        ]);
        if (!isActive) return;
        setMessages(roomMessages.map(normalizeMessage));

        if (roomFiles.length > 0) {
          const nextFiles = roomFiles.reduce<Record<string, string>>(
            (acc, file) => {
              acc[file.fileName] = file.code;
              return acc;
            },
            {},
          );
          const fileNames = Object.keys(nextFiles);
          const firstFile = fileNames[0] ?? "";
          setFiles(nextFiles);
          setOpenFiles(firstFile ? [firstFile] : []);
          setActiveFile(firstFile);
        }
      } catch (error) {
        console.error("Failed to load room state", error);
      }
    };

    loadRoomState();

    const messagesChannel = subscribeToMessages(
      currentRoomId,
      (message) => {
        upsertMessage(message);
        setActivity((prev) => [
          ...prev,
          `Message from ${message.userId}`,
        ]);
      },
    );
    const codeChannel = subscribeToCodeFiles(currentRoomId, (codeFile) => {
      applyCodeUpdate(codeFile.fileName, codeFile.code);
    });

    return () => {
      isActive = false;
      messagesChannel?.unsubscribe();
      codeChannel?.unsubscribe();
    };
  }, [
    currentRoomId,
    currentUserId,
    applyCodeUpdate,
    normalizeMessage,
    upsertMessage,
  ]);

  useEffect(() => {
    return () => {
      Object.values(codeSaveTimers.current).forEach((timer) =>
        clearTimeout(timer),
      );
      codeSaveTimers.current = {};
    };
  }, [currentRoomId]);

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
    saveCodeFile({
      roomId: currentRoomId,
      fileName: name,
      code: "",
      updatedBy: currentUserId || null,
    }).catch((error) => {
      console.error("Failed to persist new file", error);
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
    scheduleCodeSave(fileName, code);
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
    try {
      const saved = await saveMessage({
        roomId: currentRoomId,
        userId: currentUserId,
        displayName: currentDisplayName,
        message,
      });
      upsertMessage(saved);
    } catch (error) {
      console.error("Failed to send message", error);
    }
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
