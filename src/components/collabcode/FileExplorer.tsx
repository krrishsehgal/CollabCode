import { File, FilePlus } from "lucide-react";

type FileEntry = {
  id: string;
  name: string;
  content: string;
  room_id: string;
  created_at: number;
};

const FileExplorer = ({
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
}: {
  files: Record<string, FileEntry>;
  activeFile: string;
  onSelectFile: (name: string) => void;
  onCreateFile: () => void;
}) => {
  const fileList = Object.keys(files);

  const handleCreate = () => {
    onCreateFile();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-glass-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
      </div>
      <div className="p-2 border-b border-glass-border space-y-2">
        <button
          onClick={handleCreate}
          className="h-8 px-3 rounded-md bg-primary/20 text-foreground text-xs flex items-center gap-1.5 hover:bg-primary/30 transition-colors"
        >
          <FilePlus className="w-3.5 h-3.5" />
          New File
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {fileList.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">No files yet</p>
        ) : (
          fileList.map((name) => (
            <button
              key={name}
              onClick={() => onSelectFile(name)}
              className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-colors ${
                activeFile === name
                  ? "bg-primary/15 text-foreground neon-glow-purple"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <File className="w-4 h-4 text-neon-purple" />
              <span className="truncate">{name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
