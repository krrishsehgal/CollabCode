import { File, FilePlus } from "lucide-react";
import { useState } from "react";

const FileExplorer = ({
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
}: {
  files: Record<string, string>;
  activeFile: string;
  onSelectFile: (name: string) => void;
  onCreateFile: (name: string) => void;
}) => {
  const [fileName, setFileName] = useState("");
  const [fileExt, setFileExt] = useState("js");
  const fileList = Object.keys(files);

  const handleCreate = () => {
    const trimmedName = fileName.trim();
    const trimmedExt = fileExt.trim().replace(/^\./, "");
    if (!trimmedName || !trimmedExt) return;
    onCreateFile(`${trimmedName}.${trimmedExt}`);
    setFileName("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-glass-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
      </div>
      <div className="p-2 border-b border-glass-border space-y-2">
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="filename"
          className="w-full h-8 px-2 rounded-md bg-secondary text-sm outline-none"
        />
        <div className="flex gap-2">
          <input
            value={fileExt}
            onChange={(e) => setFileExt(e.target.value)}
            placeholder="ext"
            className="w-16 h-8 px-2 rounded-md bg-secondary text-sm outline-none"
          />
          <button
            onClick={handleCreate}
            className="h-8 px-3 rounded-md bg-primary/20 text-foreground text-xs flex items-center gap-1.5 hover:bg-primary/30 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
            New File
          </button>
        </div>
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
