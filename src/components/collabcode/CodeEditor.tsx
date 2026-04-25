import { ChevronDown, Copy, Play, X, Save } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useFiles } from "@/hooks/useFiles";
import { useAuth } from "@/contexts/AuthContext";

const CodeEditor = ({
  openFiles,
  activeFile,
  onSelectFile,
  onCloseFile,
  roomId = "ab7x-k92m",
}: {
  openFiles: string[];
  activeFile: string;
  onSelectFile: (name: string) => void;
  onCloseFile: (name: string) => void;
  roomId?: string;
}) => {
  const { files, saveFile } = useFiles(roomId);
  const { user } = useAuth();
  const [code, setCode] = useState("");

  // Update code when activeFile or files change
  useEffect(() => {
    setCode(files[activeFile] || "");
  }, [activeFile, files]);

  const handleSave = async () => {
    await saveFile(activeFile, code);
  };

  const lines = code.split("\n");

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="h-11 glass border-b border-glass-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">Room:</span>
          <span className="text-xs font-mono text-neon-blue">{roomId}</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-neon-blue transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </motion.button>
          <span className="text-xs text-muted-foreground ml-2">
            {user?.user_metadata?.display_name || user?.email}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button className="h-7 px-3 rounded-lg glass text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            TypeScript <ChevronDown className="w-3 h-3" />
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            className="h-7 px-4 rounded-lg bg-neon-blue/80 text-background text-xs font-medium flex items-center gap-1.5 hover:bg-neon-blue transition-colors"
          >
            <Save className="w-3 h-3" /> Save
          </motion.button>
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
      <div className="flex-1 overflow-hidden flex">
        {/* Line numbers */}
        <div className="w-12 bg-secondary/30 border-r border-glass-border overflow-hidden flex-shrink-0">
          <pre className="font-mono text-[13px] leading-6 p-4 text-muted-foreground/40 text-right">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </pre>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full font-mono text-[13px] leading-6 p-4 bg-transparent border-none outline-none text-secondary-foreground resize-none"
            spellCheck="false"
            placeholder="Select or create a file to start editing..."
          />
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
