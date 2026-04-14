import { ChevronRight, File, FilePlus, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  language?: string;
}

const mockFiles: FileNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "components",
        type: "folder",
        children: [
          { name: "App.tsx", type: "file", language: "tsx" },
          { name: "Header.tsx", type: "file", language: "tsx" },
          { name: "Editor.tsx", type: "file", language: "tsx" },
        ],
      },
      { name: "main.tsx", type: "file", language: "tsx" },
      { name: "index.css", type: "file", language: "css" },
      { name: "utils.ts", type: "file", language: "ts" },
    ],
  },
  { name: "package.json", type: "file", language: "json" },
  { name: "tsconfig.json", type: "file", language: "json" },
  { name: "README.md", type: "file", language: "md" },
];

const FileTreeItem = ({
  node,
  depth = 0,
  activeFile,
  onSelect,
}: {
  node: FileNode;
  depth?: number;
  activeFile: string;
  onSelect: (name: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isActive = node.type === "file" && activeFile === node.name;

  return (
    <div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          if (node.type === "folder") setIsOpen(!isOpen);
          else onSelect(node.name);
        }}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-sm transition-all group ${
          isActive
            ? "bg-primary/15 text-foreground neon-glow-purple"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === "folder" && (
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.span>
        )}
        {node.type === "folder" ? (
          isOpen ? <FolderOpen className="w-4 h-4 text-neon-blue" /> : <Folder className="w-4 h-4 text-neon-blue" />
        ) : (
          <File className="w-4 h-4 text-neon-purple ml-5" />
        )}
        <span className="truncate">{node.name}</span>
      </motion.button>

      <AnimatePresence>
        {node.type === "folder" && isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <FileTreeItem
                key={child.name}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FileExplorer = ({
  activeFile,
  onSelectFile,
}: {
  activeFile: string;
  onSelectFile: (name: string) => void;
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-glass-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
        <div className="flex gap-1">
          <button className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {mockFiles.map((node) => (
          <FileTreeItem key={node.name} node={node} activeFile={activeFile} onSelect={onSelectFile} />
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;
