import { useState } from "react";
import { ChevronDown, Copy, Play, X } from "lucide-react";
import { motion } from "framer-motion";

type FileEntry = {
  id: string;
  name: string;
  content: string;
  room_id: string;
  created_at: number;
};

const CodeEditor = ({
  files,
  openFiles,
  activeFile,
  onSelectFile,
  onCloseFile,
  onCodeChange,
  roomId = "ab7x-k92m",
}: {
  files: Record<string, FileEntry>;
  openFiles: string[];
  activeFile: string;
  onSelectFile: (name: string) => void;
  onCloseFile: (name: string) => void;
  onCodeChange: (fileName: string, code: string) => void;
  roomId?: string;
}) => {
  const code = activeFile ? files[activeFile]?.content ?? "" : "";
  const [copied, setCopied] = useState(false);

  const handleCodeChange = (nextCode: string) => {
    if (!activeFile) return;
    onCodeChange(activeFile, nextCode);
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.log("Failed to copy room ID", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="h-11 glass border-b border-glass-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">Room:</span>
          <span className="text-xs font-mono text-neon-blue">{roomId}</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCopyRoomId}
            className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-neon-blue transition-colors"
            aria-label="Copy room ID"
          >
            <Copy className="w-3.5 h-3.5" />
          </motion.button>
          {copied && <span className="text-[10px] text-neon-green">Copied!</span>}
        </div>

        <div className="flex items-center gap-2">
          <button className="h-7 px-3 rounded-lg glass text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            TypeScript <ChevronDown className="w-3 h-3" />
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="h-7 px-4 rounded-lg bg-neon-green/80 text-background text-xs font-medium flex items-center gap-1.5"
          >
            <Play className="w-3 h-3" /> Run
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="h-9 border-b border-glass-border flex items-center overflow-x-auto scrollbar-thin shrink-0">
        {openFiles.map((file) => (
          <button
            key={file}
            onClick={() => onSelectFile(file)}
            className={`h-full px-4 text-xs flex items-center gap-2 border-r border-glass-border transition-colors shrink-0 ${
              activeFile === file
                ? "bg-secondary text-foreground border-b-2 border-b-neon-purple"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {file}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(file);
              }}
              className="w-4 h-4 rounded hover:bg-muted flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        ))}
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-hidden">
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={!activeFile}
          placeholder={activeFile ? "" : "Create or select a file to start editing"}
          className="w-full h-full bg-transparent p-4 resize-none outline-none font-mono text-[13px] leading-6 text-secondary-foreground"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
