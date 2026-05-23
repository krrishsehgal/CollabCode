import { File, FilePlus, Loader2, Trash2 } from "lucide-react";

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
  onDeleteFile,
  onLoadWorkspace,
  isLoadingWorkspace = false,
  loadErrorMessage = "",
}: {
  files: Record<string, FileEntry>;
  activeFile: string;
  onSelectFile: (name: string) => void;
  onCreateFile: () => void;
  onDeleteFile: (name: string) => void;
  onLoadWorkspace: () => void;
  isLoadingWorkspace?: boolean;
  loadErrorMessage?: string;
}) => {
  const fileList = Object.keys(files);

  const handleCreate = () => {
    onCreateFile();
  };

  const handleLoadWorkspace = () => {
    onLoadWorkspace();
  };

  const handleDeleteFile = (name: string) => {
    onDeleteFile(name);
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
        ) : fileList.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">
            No files yet
          </p>
        ) : (
          fileList.map((name) => (
            <div
              key={name}
              className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-colors ${
                activeFile === name
                  ? "bg-primary/15 text-foreground neon-glow-purple"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectFile(name)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <File className="w-4 h-4 text-neon-purple" />
                <span className="truncate">{name}</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteFile(name);
                }}
                disabled={isLoadingWorkspace}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label={`Delete ${name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
