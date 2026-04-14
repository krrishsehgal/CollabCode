import { useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/collabcode/Navbar";
import FileExplorer from "@/components/collabcode/FileExplorer";
import CodeEditor from "@/components/collabcode/CodeEditor";
import ActiveUsers from "@/components/collabcode/ActiveUsers";
import ChatPanel from "@/components/collabcode/ChatPanel";
import TerminalPanel from "@/components/collabcode/Terminal";
import NotificationToast from "@/components/collabcode/NotificationToast";

const Index = () => {
  const { roomId } = useParams();
  const [activeFile, setActiveFile] = useState("App.tsx");
  const [openFiles, setOpenFiles] = useState(["App.tsx", "Header.tsx", "main.tsx"]);
  const [terminalOpen, setTerminalOpen] = useState(true);

  const handleSelectFile = (name: string) => {
    setActiveFile(name);
    if (!openFiles.includes(name)) {
      setOpenFiles([...openFiles, name]);
    }
  };

  const handleCloseFile = (name: string) => {
    const newFiles = openFiles.filter((f) => f !== name);
    setOpenFiles(newFiles);
    if (activeFile === name && newFiles.length > 0) {
      setActiveFile(newFiles[newFiles.length - 1]);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <NotificationToast />
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-60 border-r border-glass-border bg-card shrink-0 overflow-hidden">
          <FileExplorer activeFile={activeFile} onSelectFile={handleSelectFile} />
        </div>

        {/* Center Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              openFiles={openFiles}
              activeFile={activeFile}
              onSelectFile={setActiveFile}
              onCloseFile={handleCloseFile}
              roomId={roomId || "unknown"}
            />
          </div>
          <TerminalPanel isOpen={terminalOpen} onToggle={() => setTerminalOpen(!terminalOpen)} />
        </div>

        {/* Right Sidebar */}
        <div className="w-60 border-l border-glass-border bg-card shrink-0 flex flex-col overflow-hidden">
          <ActiveUsers />
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};

export default Index;
