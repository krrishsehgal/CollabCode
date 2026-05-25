import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { ChevronDown, Copy, Play, X } from "lucide-react";
import { motion } from "framer-motion";
import type { editor as MonacoEditor } from "monaco-editor";

type FileEntry = {
  id: string;
  name: string;
  content: string;
  room_id: string;
  created_at: number;
  updated_at: number;
  language: string;
};

type RemoteCursor = {
  userId: string;
  displayName: string;
  fileName: string;
  lineNumber: number;
  column: number;
  isTyping?: boolean;
};

type CursorChangePayload = {
  fileName: string;
  lineNumber: number;
  column: number;
  isTyping?: boolean;
};

const getCursorColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 80% 60%)`;
};

const sanitizeUserId = (userId: string) =>
  userId.replace(/[^a-zA-Z0-9_-]/g, "_");

const CodeEditor = ({
  files,
  openFiles,
  activeFile,
  language,
  remoteCursors,
  onSelectFile,
  onCloseFile,
  onCodeChange,
  onCursorChange,
  onEditorMount,
  roomId = "ab7x-k92m",
  isLoading = false,
}: {
  files: Record<string, FileEntry>;
  openFiles: string[];
  activeFile: string;
  language?: string;
  remoteCursors?: Record<string, RemoteCursor>;
  onSelectFile: (name: string) => void;
  onCloseFile: (name: string) => void;
  onCodeChange: (fileName: string, code: string) => void;
  onCursorChange?: (payload: CursorChangePayload) => void;
  onEditorMount?: OnMount;
  roomId?: string;
  isLoading?: boolean;
}) => {
  const code = activeFile ? (files[activeFile]?.content ?? "") : "";
  const editorLanguage =
    language ??
    (activeFile ? files[activeFile]?.language : undefined) ??
    "plaintext";
  const [copied, setCopied] = useState(false);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const suppressChangeRef = useRef(false);

  const handleCodeChange = (nextCode: string) => {
    if (!activeFile) return;
    onCodeChange(activeFile, nextCode);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile) return;
    if (suppressChangeRef.current) return;
    const nextCode = value ?? "";

    handleCodeChange(nextCode);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    onEditorMount?.(editor, monaco);
    if (onCursorChange && activeFile) {
      const position = editor.getPosition();
      if (position) {
        onCursorChange({
          fileName: activeFile,
          lineNumber: position.lineNumber,
          column: position.column,
          isTyping: isTypingRef.current,
        });
      }
    }
  };

  const ensureCursorStyles = useCallback(
    (classId: string, color: string, displayName: string) => {
      if (typeof document === "undefined") return;
      const styleId = `remote-cursor-style-${classId}`;
      const existing = document.getElementById(
        styleId,
      ) as HTMLStyleElement | null;
      const safeLabel = displayName
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, " ");

      const css = `
      .monaco-editor .remote-cursor-caret-${classId} {
        border-left: 2px solid ${color};
        margin-left: -1px;
        height: 1.2em;
        display: inline-block;
        vertical-align: middle;
      }
      .monaco-editor .remote-cursor-label-${classId} {
        position: relative;
        display: inline-block;
        pointer-events: none;
      }
      .monaco-editor .remote-cursor-label-${classId}::after {
        content: "${safeLabel}";
        position: absolute;
        top: -1.8em;
        left: -1px;
        background: ${color};
        color: #ffffff;
        padding: 2px 6px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 600;
        line-height: 1.3;
        white-space: nowrap;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
        transform: translateY(-2px);
        transition: opacity 120ms ease, transform 120ms ease;
        opacity: 0.95;
        letter-spacing: 0.3px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        pointer-events: none;
      }
    `;
      if (existing) {
        if (existing.textContent !== css) {
          existing.textContent = css;
        }
        return;
      }

      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
    },
    [],
  );

  const emitCursorPosition = useCallback(() => {
    if (!onCursorChange || !activeFile) return;
    const editor = editorRef.current;
    if (!editor) return;
    const position = editor.getPosition();
    if (!position) return;
    onCursorChange({
      fileName: activeFile,
      lineNumber: position.lineNumber,
      column: position.column,
      isTyping: isTypingRef.current,
    });
  }, [activeFile, onCursorChange]);

  useEffect(() => {
    emitCursorPosition();
  }, [emitCursorPosition]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !onCursorChange || !activeFile) return;
    const subscription = editor.onDidChangeCursorPosition((event) => {
      onCursorChange({
        fileName: activeFile,
        lineNumber: event.position.lineNumber,
        column: event.position.column,
        isTyping: isTypingRef.current,
      });
    });
    return () => subscription.dispose();
  }, [activeFile, onCursorChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !onCursorChange || !activeFile) return;

    const subscription = editor.onDidChangeModelContent(() => {
      if (!activeFile) return;
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        emitCursorPosition();
      }
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        isTypingRef.current = false;
        emitCursorPosition();
      }, 1000);
    });

    return () => {
      subscription.dispose();
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [activeFile, emitCursorPosition, onCursorChange]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    if (model.getValue() === code) return;

    const position = editor.getPosition();
    const selection = editor.getSelection();

    suppressChangeRef.current = true;
    editor.pushUndoStop();
    editor.executeEdits("remote-sync", [
      { range: model.getFullModelRange(), text: code, forceMoveMarkers: true },
    ]);
    editor.pushUndoStop();
    suppressChangeRef.current = false;

    if (selection) {
      editor.setSelection(model.validateRange(selection));
    }
    if (position) {
      editor.setPosition(model.validatePosition(position));
    }
  }, [code, activeFile]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const active = activeFile;
    const cursors = remoteCursors ? Object.values(remoteCursors) : [];
    if (!active || cursors.length === 0) {
      decorationIdsRef.current = editor.deltaDecorations(
        decorationIdsRef.current,
        [],
      );
      return;
    }

    const decorations = cursors
      .filter((cursor) => cursor.fileName === active)
      .map((cursor) => {
        const color = getCursorColor(cursor.userId);
        const classId = sanitizeUserId(cursor.userId);
        ensureCursorStyles(classId, color, cursor.displayName);
        return {
          range: new monaco.Range(
            cursor.lineNumber,
            cursor.column,
            cursor.lineNumber,
            cursor.column,
          ),
          options: {
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            className: `remote-cursor-caret-${classId}`,
            afterContentClassName: `remote-cursor-label-${classId}`,
          },
        };
      });

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      decorations,
    );
  }, [activeFile, ensureCursorStyles, remoteCursors]);

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
          {copied && (
            <span className="text-[10px] text-neon-green">Copied!</span>
          )}
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
        <div className="relative h-full">
          <Editor
            value={code}
            path={activeFile || "__empty__"}
            language={editorLanguage}
            theme="vs-dark"
            onMount={handleEditorMount}
            onChange={handleEditorChange}
            options={{
              readOnly: !activeFile || isLoading,
              automaticLayout: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 24,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              renderLineHighlight: "all",
            }}
          />
          {(!activeFile || isLoading) && (
            <div className="pointer-events-none absolute inset-0 flex items-start p-4 font-mono text-[13px] leading-6 text-muted-foreground">
              {isLoading
                ? "Loading files..."
                : "Create or select a file to start editing"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
