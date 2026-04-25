import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/collabcode/Navbar";
import FileExplorer from "@/components/collabcode/FileExplorer";
import CodeEditor from "@/components/collabcode/CodeEditor";
import ActiveUsers from "@/components/collabcode/ActiveUsers";
import ChatPanel from "@/components/collabcode/ChatPanel";
import TerminalPanel from "@/components/collabcode/Terminal";
import { useSocket } from "@/hooks/useSocket";

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
  const [messages, setMessages] = useState<
    { userId: string; displayName: string; message: string }[]
  >([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(true);

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
      setFiles((prev) => ({ ...prev, [fileName]: code }));
      setActivity((prev) => [...prev, `Code updated: ${fileName}`]);
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
    }: {
      userId: string;
      displayName: string;
      message: string;
    }) => {
      setMessages((prev) => [
        ...prev,
        {
          userId,
          displayName: userId === currentUserId ? "You" : displayName,
          message,
        },
      ]);
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
  }, [socket, currentUserId]);

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

  const handleSendMessage = (message: string) => {
    if (!currentUserId || !currentRoomId) return;
    socket?.emit("send-message", {
      roomId: currentRoomId,
      userId: currentUserId,
      displayName: currentDisplayName,
      message,
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
