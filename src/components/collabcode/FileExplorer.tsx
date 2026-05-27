import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizePath, isPlaceholderFile, FOLDER_PLACEHOLDER } from "@/lib/filePaths";

type FileEntry = {
  id: string;
  name: string;
  content: string;
  room_id: string;
  created_at: number;
  updated_at: number;
  language: string;
};

const FileExplorer = ({
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteFile,
  onLoadWorkspace,
  isLoadingWorkspace = false,
  loadErrorMessage = "",
}: {
  files: Record<string, FileEntry>;
  activeFile: string;
  onSelectFile: (name: string) => void;
  onCreateFile: (parentPath?: string) => void;
  onCreateFolder: () => void;
  onRenameFolder: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onDeleteFile: (name: string) => void;
  onLoadWorkspace: () => void;
  isLoadingWorkspace?: boolean;
  loadErrorMessage?: string;
}) => {
  const fileList = Object.keys(files);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const didInitExpanded = useRef(false);

  type TreeNode = {
    type: "folder" | "file";
    name: string;
    path: string;
    children?: TreeNode[];
  };

  const tree = useMemo(() => {
    const root: TreeNode = { type: "folder", name: "", path: "", children: [] };
    const folderIndex = new Map<string, TreeNode>();
    folderIndex.set("", root);

    fileList.forEach((rawName) => {
      const normalized = normalizePath(rawName);
      if (!normalized) return;
      const segments = normalized.split("/");
      let current = root;
      let currentPath = "";

      segments.forEach((segment, index) => {
        const isLast = index === segments.length - 1;
        if (isLast) {
          if (segment === FOLDER_PLACEHOLDER || isPlaceholderFile(normalized)) {
            return;
          }
          current.children = current.children ?? [];
          current.children.push({
            type: "file",
            name: segment,
            path: normalized,
          });
          return;
        }

        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        let folder = folderIndex.get(currentPath);
        if (!folder) {
          folder = {
            type: "folder",
            name: segment,
            path: currentPath,
            children: [],
          };
          folderIndex.set(currentPath, folder);
          current.children = current.children ?? [];
          current.children.push(folder);
        }
        current = folder;
      });
    });

    const sortNodes = (node: TreeNode) => {
      if (!node.children) return;
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortNodes);
    };

    sortNodes(root);
    return root;
  }, [fileList]);

  useEffect(() => {
    if (didInitExpanded.current) return;
    const next = new Set<string>();
    const walk = (node: TreeNode) => {
      if (node.type === "folder" && node.path) {
        next.add(node.path);
      }
      node.children?.forEach(walk);
    };
    walk(tree);
    setExpandedFolders(next);
    didInitExpanded.current = true;
  }, [tree]);

  const handleCreate = () => {
    onCreateFile();
  };

  const handleCreateInFolder = (path: string) => {
    onCreateFile(path);
  };

  const handleCreateFolder = () => {
    onCreateFolder();
  };

  const handleLoadWorkspace = () => {
    onLoadWorkspace();
  };

  const handleDeleteFile = (name: string) => {
    onDeleteFile(name);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === "folder") {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            style={{ paddingLeft: `${depth * 12}px` }}
          >
            <button
              type="button"
              onClick={() => toggleFolder(node.path)}
              className="flex items-center gap-2 flex-1 text-left min-w-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-neon-blue" />
              ) : (
                <Folder className="w-4 h-4 text-neon-blue" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleCreateInFolder(node.path);
              }}
              disabled={isLoadingWorkspace}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={`New file in ${node.name}`}
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRenameFolder(node.path);
              }}
              disabled={isLoadingWorkspace}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={`Rename ${node.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteFolder(node.path);
              }}
              disabled={isLoadingWorkspace}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={`Delete ${node.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {isExpanded
            ? node.children?.map((child) => renderNode(child, depth + 1))
            : null}
        </div>
      );
    }

    const isActive = activeFile === node.path;
    return (
      <div
        key={node.path}
        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-primary/15 text-foreground neon-glow-purple"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => onSelectFile(node.path)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <File className="w-4 h-4 text-neon-purple" />
          <span className="truncate">{node.name}</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleDeleteFile(node.path);
          }}
          disabled={isLoadingWorkspace}
          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label={`Delete ${node.name}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-glass-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
      </div>
      <div className="p-2 border-b border-glass-border space-y-2">
        <button
          onClick={handleLoadWorkspace}
          disabled={isLoadingWorkspace}
          className="h-8 px-3 rounded-md bg-secondary text-foreground text-xs flex items-center gap-1.5 hover:bg-secondary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoadingWorkspace ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : null}
          {isLoadingWorkspace ? "Loading..." : "Load Workspace"}
        </button>
        <button
          onClick={handleCreateFolder}
          disabled={isLoadingWorkspace}
          className="h-8 px-3 rounded-md bg-secondary text-foreground text-xs flex items-center gap-1.5 hover:bg-secondary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          New Folder
        </button>
        <button
          onClick={handleCreate}
          disabled={isLoadingWorkspace}
          className="h-8 px-3 rounded-md bg-primary/20 text-foreground text-xs flex items-center gap-1.5 hover:bg-primary/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <FilePlus className="w-3.5 h-3.5" />
          New File
        </button>
        {loadErrorMessage ? (
          <p className="text-xs text-destructive px-1">{loadErrorMessage}</p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {isLoadingWorkspace ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading files...
          </div>
        ) : (tree.children?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">
            No files yet
          </p>
        ) : (
          tree.children?.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
