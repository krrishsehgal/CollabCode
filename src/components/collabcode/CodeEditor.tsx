import { ChevronDown, Copy, Play, X } from "lucide-react";
import { motion } from "framer-motion";

const mockCode = `import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CollabSession {
  id: string;
  participants: User[];
  code: string;
  language: string;
}

const CollaborativeEditor: React.FC = () => {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const ws = new WebSocket('wss://collab.server/ws');

    ws.onopen = () => {
      setConnected(true);
      console.log('Connected to collaboration server');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleCollabUpdate(data);
    };

    return () => ws.close();
  }, []);

  const handleCollabUpdate = (data: any) => {
    setSession(prev => ({
      ...prev!,
      code: data.code,
      participants: data.participants,
    }));
  };

  return (
    <div className="editor-container">
      <AnimatePresence>
        {connected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="editor-panel"
          >
            {/* Editor content here */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollaborativeEditor;`;

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
  const lines = mockCode.split("\n");

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
        </div>

        <div className="flex items-center gap-2">
          <button className="h-7 px-3 rounded-lg glass text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            TypeScript <ChevronDown className="w-3 h-3" />
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="h-7 px-4 rounded-lg bg-gradient-to-r from-neon-green/80 to-neon-green text-background text-xs font-medium flex items-center gap-1.5"
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
      <div className="flex-1 overflow-auto scrollbar-thin relative">
        {/* Mock cursors */}
        <motion.div
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="absolute top-[196px] left-[340px] w-0.5 h-5 bg-neon-pink z-10 rounded-full neon-glow-pink"
        />
        <div className="absolute top-[190px] left-[340px] px-1.5 py-0.5 rounded text-[10px] bg-neon-pink/20 text-neon-pink -translate-y-full font-sans">
          Sarah
        </div>

        <motion.div
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
          className="absolute top-[292px] left-[220px] w-0.5 h-5 bg-neon-blue z-10 rounded-full neon-glow-blue"
        />
        <div className="absolute top-[286px] left-[220px] px-1.5 py-0.5 rounded text-[10px] bg-neon-blue/20 text-neon-blue -translate-y-full font-sans">
          Alex
        </div>

        <pre className="font-mono text-[13px] leading-6 p-4">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="w-10 text-right pr-4 text-muted-foreground/40 select-none shrink-0">{i + 1}</span>
                <span className="text-secondary-foreground">
                  {colorize(line)}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

function colorize(line: string) {
  return line
    .replace(/(import|from|export|default|const|let|return|new|interface|type|void)/g, '<kw>$1</kw>')
    .replace(/('.*?'|".*?")/g, '<str>$1</str>')
    .replace(/(\/\/.*)/g, '<cmt>$1</cmt>')
    .split(/(<kw>.*?<\/kw>|<str>.*?<\/str>|<cmt>.*?<\/cmt>)/)
    .map((part, i) => {
      if (part.startsWith('<kw>'))
        return <span key={i} className="text-neon-purple">{part.replace(/<\/?kw>/g, '')}</span>;
      if (part.startsWith('<str>'))
        return <span key={i} className="text-neon-green">{part.replace(/<\/?str>/g, '')}</span>;
      if (part.startsWith('<cmt>'))
        return <span key={i} className="text-muted-foreground">{part.replace(/<\/?cmt>/g, '')}</span>;
      return <span key={i}>{part}</span>;
    });
}

export default CodeEditor;
