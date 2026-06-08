import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/collabcode/Navbar";
import FileExplorer from "@/components/collabcode/FileExplorer";
import CodeEditor from "@/components/collabcode/CodeEditor";
import ActiveUsers from "@/components/collabcode/ActiveUsers";
import ChatPanel from "@/components/collabcode/ChatPanel";
import TerminalPanel from "@/components/collabcode/Terminal";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  loadRoomFiles,
  loadRoomMessages,
  resolveRoomRecord,
  saveRoomMessage,
} from "@/lib/roomData";
import { getDisplayName } from "@/lib/user";
import {
  FOLDER_PLACEHOLDER,
  isPlaceholderFile,
  normalizePath,
} from "@/lib/filePaths";
type ChatMessage = {
  id: string;
  clientMessageId?: string;
  roomId: string;
  userId: string;
  displayName: string;
  message: string;
  createdAt: string;
};

type ChatLoadState = "idle" | "loading" | "ready" | "empty" | "error";

type FileEntry = {
  id: string;
  name: string;
  content: string;
  room_id: string;
  created_at: number;
  updated_at: number;
  language: string;
};

type FolderRenameEntry = {
  from: string;
  to: string;
  content: string;
  language: string;
  id?: string;
  updatedAt: number;
};

type EditorCursor = {
  userId: string;
  displayName: string;
  fileName: string;
  lineNumber: number;
  column: number;
  isTyping?: boolean;
};

type ExecutionOutput = {
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  errorMessage: string;
  status?: string;
  statusId?: number | null;
  time?: string | null;
  memory?: number | null;
  language?: string;
  languageId?: number | null;
  fileName?: string;
};

const CURSOR_EMIT_INTERVAL_MS = 40;

const Index = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const currentRoomId = roomId || "";
  const currentDisplayName = getDisplayName(user);
  const socket = useSocket({
    roomId: currentRoomId,
    userId: user?.id,
    displayName: currentDisplayName,
  });
  const currentUserId = user?.id || "";
  const [files, setFiles] = useState<Record<string, FileEntry>>({});
  const [activeFile, setActiveFile] = useState("");
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [roomDbId, setRoomDbId] = useState("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [chatLoadState, setChatLoadState] = useState<ChatLoadState>("idle");
  const [chatLoadError, setChatLoadError] = useState("");
  const [users, setUsers] = useState<
    Array<{ userId: string; displayName: string }>
  >([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<
    Record<string, EditorCursor>
  >({});
  const [, setActivity] = useState<string[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [executionOutput, setExecutionOutput] = useState<ExecutionOutput>({
    stdout: "",
    stderr: "",
    compileOutput: "",
    message: "",
    errorMessage: "",
  });
  const [stdinValue, setStdinValue] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const filesRef = useRef<Record<string, FileEntry>>({});
  const messagesRef = useRef<ChatMessage[]>([]);
  const saveTimersRef = useRef<Record<string, number>>({});
  const pendingSavesRef = useRef<Record<string, string>>({});
  const activeFileRef = useRef(activeFile);
  const roomResolutionPromiseRef = useRef<Promise<string> | null>(null);
  const cursorEmitRef = useRef<{
    lastEmit: number;
    timer: number | null;
    pending: { fileName: string; lineNumber: number; column: number } | null;
  }>({
    lastEmit: 0,
    timer: null,
    pending: null,
  });
  const lastLoadedRoomRef = useRef("");
  const autoLoadAttemptedRef = useRef(false);
  const normalizeFilePath = useCallback(
    (raw: string) => normalizePath(raw),
    [],
  );
  const getVisibleFileNames = useCallback(
    (fileMap: Record<string, FileEntry>) =>
      Object.keys(fileMap).filter((name) => !isPlaceholderFile(name)),
    [],
  );
  const getNextActiveFile = useCallback(
    (fileMap: Record<string, FileEntry>, currentActive: string) => {
      const visibleNames = getVisibleFileNames(fileMap);
      if (visibleNames.includes(currentActive)) return currentActive;
      return visibleNames[0] ?? "";
    },
    [getVisibleFileNames],
  );
  const createClientMessageId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const ensureRoomDbId = useCallback(async () => {
    if (!currentRoomId || !currentUserId) return "";
    if (roomDbId) return roomDbId;
    if (roomResolutionPromiseRef.current) {
      const pendingRoomId = await roomResolutionPromiseRef.current;
      return pendingRoomId;
    }

    roomResolutionPromiseRef.current = (async () => {
      const room = await resolveRoomRecord(currentRoomId, currentUserId);
      return room.id;
    })();

    try {
      const resolvedRoomId = await roomResolutionPromiseRef.current;
      if (resolvedRoomId) {
        setRoomDbId(resolvedRoomId);
      }
      return resolvedRoomId;
    } finally {
      roomResolutionPromiseRef.current = null;
    }
  }, [currentRoomId, currentUserId, roomDbId]);
  const createFileId = useCallback(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);
  const inferLanguageFromFileName = useCallback((fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "c":
      case "h":
        return "c";
      case "cpp":
      case "hpp":
      case "cc":
      case "cxx":
        return "cpp";
      case "py":
        return "python";
      case "java":
        return "java";
      case "go":
        return "go";
      case "rs":
        return "rust";
      case "rb":
        return "ruby";
      case "php":
        return "php";
      case "sh":
      case "bash":
        return "shell";
      case "yml":
      case "yaml":
        return "yaml";
      case "toml":
        return "toml";
      case "sql":
        return "sql";
      case "json":
        return "json";
      case "html":
        return "html";
      case "xml":
        return "xml";
      case "css":
        return "css";
      case "md":
        return "markdown";
      default:
        return "plaintext";
    }
  }, []);
  const resolveJudge0Language = useCallback((fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    const languages: Record<string, { id: number; label: string }> = {
      ts: { id: 101, label: "TypeScript" },
      tsx: { id: 101, label: "TypeScript" },
      js: { id: 93, label: "JavaScript" },
      jsx: { id: 93, label: "JavaScript" },
      c: { id: 103, label: "C" },
      h: { id: 103, label: "C" },
      cpp: { id: 105, label: "C++" },
      hpp: { id: 105, label: "C++" },
      cc: { id: 105, label: "C++" },
      cxx: { id: 105, label: "C++" },
      py: { id: 100, label: "Python" },
      java: { id: 91, label: "Java" },
      go: { id: 107, label: "Go" },
      rs: { id: 108, label: "Rust" },
      rb: { id: 72, label: "Ruby" },
      php: { id: 98, label: "PHP" },
      sh: { id: 46, label: "Bash" },
      bash: { id: 46, label: "Bash" },
    };
    return extension ? languages[extension] : undefined;
  }, []);
  const formatLanguageLabel = useCallback((language: string) => {
    const normalized = language.toLowerCase();
    const labels: Record<string, string> = {
      plaintext: "Plain Text",
      typescript: "TypeScript",
      javascript: "JavaScript",
      cpp: "C++",
      c: "C",
      python: "Python",
      java: "Java",
      go: "Go",
      rust: "Rust",
      ruby: "Ruby",
      php: "PHP",
      bash: "Bash",
      shell: "Shell",
      html: "HTML",
      css: "CSS",
      json: "JSON",
      yaml: "YAML",
      toml: "TOML",
      sql: "SQL",
      markdown: "Markdown",
    };
    return labels[normalized] ?? normalized.toUpperCase();
  }, []);
  const resolveLanguage = useCallback(
    (fileName: string, storedLanguage?: string | null) => {
      const inferred = inferLanguageFromFileName(fileName);
      if (storedLanguage && storedLanguage !== "plaintext") {
        return storedLanguage;
      }
      return inferred;
    },
    [inferLanguageFromFileName],
  );
  const createFileEntry = useCallback(
    (
      name: string,
      content = "",
      overrides: Partial<FileEntry> = {},
    ): FileEntry => ({
      id: overrides.id ?? createFileId(),
      name,
      content,
      room_id: overrides.room_id ?? roomDbId ?? currentRoomId,
      created_at: overrides.created_at ?? Date.now(),
      updated_at: overrides.updated_at ?? Date.now(),
      language: resolveLanguage(name, overrides.language),
    }),
    [createFileId, currentRoomId, resolveLanguage, roomDbId],
  );

  const normalizeMessage = useCallback(
    (message: ChatMessage) => ({
      ...message,
      displayName:
        message.userId === currentUserId
          ? "You"
          : message.displayName || message.userId.slice(0, 6),
    }),
    [currentUserId],
  );

  const getChatMatchIndex = useCallback(
    (items: ChatMessage[], message: ChatMessage) => {
      const incomingTime = new Date(message.createdAt).getTime();
      return items.findIndex((item) => {
        if (item.id === message.id) {
          return true;
        }
        if (
          message.clientMessageId &&
          item.clientMessageId === message.clientMessageId
        ) {
          return true;
        }
        if (
          !message.clientMessageId &&
          item.clientMessageId &&
          item.userId === message.userId &&
          item.message === message.message
        ) {
          const itemTime = new Date(item.createdAt).getTime();
          return Math.abs(itemTime - incomingTime) <= 10000;
        }
        return false;
      });
    },
    [],
  );

  const mergeChatMessages = useCallback(
    (baseMessages: ChatMessage[], incomingMessages: ChatMessage[]) => {
      const next = [...baseMessages];
      incomingMessages.forEach((message) => {
        const normalized = normalizeMessage(message);
        const matchIndex = getChatMatchIndex(next, normalized);
        if (matchIndex >= 0) {
          next[matchIndex] = { ...next[matchIndex], ...normalized };
          return;
        }
        next.push(normalized);
      });
      next.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return next;
    },
    [getChatMatchIndex, normalizeMessage],
  );

  const upsertMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => mergeChatMessages(prev, [message]));
    },
    [mergeChatMessages],
  );

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const hydrateFilesFromRoom = useCallback(
    async () => {
      setIsLoadingFiles(true);
      setFilesError("");
      try {
        const resolvedRoomId = await ensureRoomDbId();
        if (!resolvedRoomId) {
          return false;
        }
        const remoteFiles = await loadRoomFiles(resolvedRoomId);

        const nextFiles: Record<string, FileEntry> = {};
        const usedNames = new Set<string>();
        const ensureUniqueName = (rawName: string) => {
          if (!usedNames.has(rawName)) {
            return rawName;
          }
          const lastDot = rawName.lastIndexOf(".");
          const hasExtension = lastDot > 0;
          const baseName = hasExtension ? rawName.slice(0, lastDot) : rawName;
          const extension = hasExtension ? rawName.slice(lastDot) : "";
          let counter = 2;
          let candidate = `${baseName} (${counter})${extension}`;
          while (usedNames.has(candidate)) {
            counter += 1;
            candidate = `${baseName} (${counter})${extension}`;
          }
          return candidate;
        };

        remoteFiles.forEach((file) => {
          const originalName = file.file_name || "untitled";
          const fileName = ensureUniqueName(originalName);
          usedNames.add(fileName);
          const content = file.content ?? "";
          const updatedAt = file.updated_at
            ? new Date(file.updated_at).getTime()
            : Date.now();
          nextFiles[fileName] = createFileEntry(fileName, content, {
            id: file.id,
            room_id: file.room_id,
            language: file.language ?? undefined,
            created_at: updatedAt,
            updated_at: updatedAt,
          });
        });

        setFiles(nextFiles);
        console.log("[files] loaded", Object.keys(nextFiles).length);

        const fileNames = getVisibleFileNames(nextFiles);
        const currentActive = activeFileRef.current;
        const nextActive = fileNames.includes(currentActive)
          ? currentActive
          : (fileNames[0] ?? "");
        setActiveFile(nextActive);
        setOpenFiles((prev) => {
          const filtered = prev.filter(
            (name) => name in nextFiles && !isPlaceholderFile(name),
          );
          if (nextActive && !filtered.includes(nextActive)) {
            return [...filtered, nextActive];
          }
          return filtered;
        });
        return true;
      } catch (error) {
        console.error("[supabase]", error);
        setFilesError("Failed to load files from Supabase.");
        setActivity((prev) => [...prev, "File sync error: load failed"]);
        return false;
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [createFileEntry, ensureRoomDbId, getVisibleFileNames],
  );

  const hydrateChatHistoryFromRoom = useCallback(async () => {
    setChatLoadState("loading");
    setChatLoadError("");
    try {
      const resolvedRoomId = await ensureRoomDbId();
      if (!resolvedRoomId) {
        return false;
      }

      const remoteMessages = await loadRoomMessages(resolvedRoomId);
      const nextMessages: ChatMessage[] = remoteMessages.map((msg) => ({
        id: msg.id,
        roomId: msg.room_id ?? resolvedRoomId,
        userId: msg.user_id ?? "",
        displayName: msg.display_name ?? "",
        message: msg.message ?? "",
        createdAt: msg.created_at,
      }));
      const mergedMessages = mergeChatMessages(messagesRef.current, nextMessages);

      setMessages(mergedMessages);
      setChatLoadState(mergedMessages.length === 0 ? "empty" : "ready");
      console.log("[chat] loaded", nextMessages.length);
      return true;
    } catch (error) {
      console.error("[supabase]", error);
      setChatLoadError("Failed to load chat history from database.");
      setChatLoadState("error");
      return false;
    }
  }, [ensureRoomDbId, mergeChatMessages]);

  const loadWorkspace = useCallback(
    async (options?: { force?: boolean }) => {
      if (!currentRoomId || !currentUserId) return;
      if (isLoadingFiles) return;
      if (!options?.force && lastLoadedRoomRef.current === currentRoomId) {
        return;
      }
      const didLoad = await hydrateFilesFromRoom();
      if (didLoad) {
        lastLoadedRoomRef.current = currentRoomId;
      }
    },
    [currentRoomId, currentUserId, hydrateFilesFromRoom, isLoadingFiles],
  );

  const handleLoadWorkspace = useCallback(() => {
    void loadWorkspace({ force: true });
  }, [loadWorkspace]);

  const fetchFileRecord = useCallback(
    async (fileName: string) => {
      if (!roomDbId) return null;
      const { data, error } = await supabase
        .from("files")
        .select("id, room_id, file_name, language, content, updated_at")
        .eq("room_id", roomDbId)
        .eq("file_name", fileName)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    [roomDbId],
  );

  const upsertFileRecord = useCallback(
    async (fileName: string, content: string) => {
      if (!roomDbId) return null;
      const existing = await fetchFileRecord(fileName);
      if (existing) {
        return existing;
      }
      const { data, error } = await supabase
        .from("files")
        .insert({
          room_id: roomDbId,
          file_name: fileName,
          language: inferLanguageFromFileName(fileName),
          content,
        })
        .select("id, room_id, file_name, language, content, updated_at")
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        console.debug("Stored filename", {
          fileName: data.file_name,
          roomId: data.room_id,
          fileId: data.id,
        });
      }

      return data;
    },
    [fetchFileRecord, inferLanguageFromFileName, roomDbId],
  );

  const syncLocalFileFromRecord = useCallback(
    (record: {
      id: string;
      room_id: string;
      file_name: string | null;
      language: string | null;
      content: string | null;
      updated_at: string | null;
    }) => {
      const fileName = record.file_name || "untitled";
      const updatedAt = record.updated_at
        ? new Date(record.updated_at).getTime()
        : Date.now();
      setFiles((prev) => {
        if (!(fileName in prev)) return prev;
        const nextEntry: FileEntry = {
          ...prev[fileName],
          id: record.id,
          room_id: record.room_id,
          content: record.content ?? prev[fileName].content,
          language: resolveLanguage(
            fileName,
            record.language ?? prev[fileName].language,
          ),
          updated_at: updatedAt,
        };
        return { ...prev, [fileName]: nextEntry };
      });
    },
    [resolveLanguage],
  );

  const persistFileContent = useCallback(
    async (fileName: string, content: string) => {
      if (!roomDbId) return;
      try {
        const existing = filesRef.current[fileName];
        const updatedAt = new Date().toISOString();
        if (existing?.id) {
          const { data, error } = await supabase
            .from("files")
            .update({ content, updated_at: updatedAt })
            .eq("id", existing.id)
            .select("id, room_id, file_name, language, content, updated_at")
            .single();

          if (error) {
            throw error;
          }

          if (data) {
            syncLocalFileFromRecord(data);
          }
          return;
        }

        const ensured = await upsertFileRecord(fileName, content);
        if (!ensured) return;

        if (ensured.content !== content) {
          const { data, error } = await supabase
            .from("files")
            .update({ content, updated_at: updatedAt })
            .eq("id", ensured.id)
            .select("id, room_id, file_name, language, content, updated_at")
            .single();

          if (error) {
            throw error;
          }

          if (data) {
            syncLocalFileFromRecord(data);
          }
          return;
        }

        syncLocalFileFromRecord(ensured);
      } catch (error) {
        console.error("Failed to auto-save file", error);
        setActivity((prev) => [...prev, `Auto-save failed: ${fileName}`]);
      }
    },
    [roomDbId, syncLocalFileFromRecord, upsertFileRecord],
  );

  const scheduleAutoSave = useCallback(
    (fileName: string, content: string) => {
      if (!roomDbId) {
        pendingSavesRef.current[fileName] = content;
        return;
      }
      const existingTimer = saveTimersRef.current[fileName];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }
      saveTimersRef.current[fileName] = window.setTimeout(() => {
        void persistFileContent(fileName, content);
      }, 2000);
    },
    [persistFileContent, roomDbId],
  );

  const removeFilesFromState = useCallback(
    (fileNames: string[]) => {
      const currentFiles = filesRef.current;
      const uniqueNames = Array.from(new Set(fileNames)).filter(
        (name) => name in currentFiles,
      );
      if (uniqueNames.length === 0) return;

      const nextFiles = { ...currentFiles };
      uniqueNames.forEach((name) => {
        delete nextFiles[name];
      });
      filesRef.current = nextFiles;
      setFiles(nextFiles);

      const nextActive = getNextActiveFile(nextFiles, activeFileRef.current);
      setActiveFile(nextActive);
      setOpenFiles((prev) => {
        const filtered = prev.filter(
          (name) => name in nextFiles && !isPlaceholderFile(name),
        );
        if (nextActive && !filtered.includes(nextActive)) {
          return [...filtered, nextActive];
        }
        return filtered;
      });

      uniqueNames.forEach((fileName) => {
        const timer = saveTimersRef.current[fileName];
        if (timer) {
          window.clearTimeout(timer);
          delete saveTimersRef.current[fileName];
        }
        if (fileName in pendingSavesRef.current) {
          delete pendingSavesRef.current[fileName];
        }
      });
    },
    [getNextActiveFile],
  );

  const removeFileFromState = useCallback(
    (fileName: string) => {
      removeFilesFromState([fileName]);
    },
    [removeFilesFromState],
  );

  const applyFolderRename = useCallback(
    (entries: FolderRenameEntry[]) => {
      if (entries.length === 0) return;
      const currentFiles = filesRef.current;
      const nextFiles = { ...currentFiles };
      const renameMap = new Map<string, string>();

      entries.forEach((entry) => {
        const existing = currentFiles[entry.from];
        if (!existing) return;
        renameMap.set(entry.from, entry.to);
        nextFiles[entry.to] = {
          ...existing,
          id: entry.id ?? existing.id,
          name: entry.to,
          content: entry.content ?? existing.content,
          language: entry.language ?? existing.language,
          updated_at: entry.updatedAt || Date.now(),
        };
        delete nextFiles[entry.from];

        const timer = saveTimersRef.current[entry.from];
        if (timer) {
          window.clearTimeout(timer);
          delete saveTimersRef.current[entry.from];
        }
        if (entry.from in pendingSavesRef.current) {
          pendingSavesRef.current[entry.to] =
            pendingSavesRef.current[entry.from];
          delete pendingSavesRef.current[entry.from];
        }
      });

      filesRef.current = nextFiles;
      setFiles(nextFiles);

      const nextActiveCandidate =
        renameMap.get(activeFileRef.current) ?? activeFileRef.current;
      const nextActive = getNextActiveFile(nextFiles, nextActiveCandidate);
      setActiveFile(nextActive);
      setOpenFiles((prev) => {
        const mapped = prev
          .map((name) => renameMap.get(name) ?? name)
          .filter((name) => name in nextFiles && !isPlaceholderFile(name));
        if (nextActive && !mapped.includes(nextActive)) {
          return [...mapped, nextActive];
        }
        return mapped;
      });
    },
    [getNextActiveFile],
  );

  useEffect(() => {
    if (!roomDbId) return;
    const pending = pendingSavesRef.current;
    const pendingEntries = Object.entries(pending);
    if (pendingEntries.length === 0) return;
    pendingSavesRef.current = {};
    pendingEntries.forEach(([fileName, content]) => {
      scheduleAutoSave(fileName, content);
    });
  }, [roomDbId, scheduleAutoSave]);

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
      saveTimersRef.current = {};
      if (cursorEmitRef.current.timer !== null) {
        window.clearTimeout(cursorEmitRef.current.timer);
      }
      cursorEmitRef.current = {
        lastEmit: 0,
        timer: null,
        pending: null,
      };
    };
  }, [currentRoomId]);

  const applyCodeUpdate = useCallback(
    (fileName: string, code: string) => {
      let nextActivity: string | null = null;
      setFiles((prev) => {
        const existing = prev[fileName];
        if (existing?.content === code) {
          return prev;
        }
        nextActivity = existing
          ? `Code updated: ${fileName}`
          : `File created: ${fileName}`;
        const nextEntry = existing
          ? { ...existing, content: code, updated_at: Date.now() }
          : createFileEntry(fileName, code);
        return { ...prev, [fileName]: nextEntry };
      });
      if (nextActivity) {
        setActivity((prev) => [...prev, nextActivity]);
      }
    },
    [createFileEntry],
  );

  useEffect(() => {
    if (!socket) return;

    const handleFileCreated = (fileName: string) => {
      if (!fileName) return;
      const isPlaceholder = isPlaceholderFile(fileName);
      setFiles((prev) => {
        if (fileName in prev) return prev;
        return { ...prev, [fileName]: createFileEntry(fileName, "") };
      });
      if (isPlaceholder) {
        const folderPath = fileName.replace(`/${FOLDER_PLACEHOLDER}`, "");
        setActivity((prev) => [...prev, `Folder created: ${folderPath}`]);
      } else {
        setActivity((prev) => [...prev, `File created: ${fileName}`]);
      }
    };

    const handleCodeUpdate = ({
      fileName,
      code,
    }: {
      fileName: string;
      code: string;
    }) => {
      if (!fileName) return;
      applyCodeUpdate(fileName, code);
    };

    const handleEditorCursorUpdate = ({
      userId,
      displayName,
      fileName,
      lineNumber,
      column,
      isTyping,
    }: {
      userId: string;
      displayName?: string;
      fileName: string;
      lineNumber: number;
      column: number;
      isTyping?: boolean;
    }) => {
      if (!userId || userId === currentUserId) return;
      if (!fileName) return;
      if (typeof lineNumber !== "number" || typeof column !== "number") return;
      const normalizedName =
        typeof displayName === "string" && displayName.trim()
          ? displayName
          : userId.slice(0, 6);
      setRemoteCursors((prev) => {
        const existing = prev[userId];
        if (
          existing &&
          existing.fileName === fileName &&
          existing.lineNumber === lineNumber &&
          existing.column === column &&
          existing.displayName === normalizedName &&
          existing.isTyping === Boolean(isTyping)
        ) {
          return prev;
        }
        return {
          ...prev,
          [userId]: {
            userId,
            displayName: normalizedName,
            fileName,
            lineNumber,
            column,
            isTyping: Boolean(isTyping),
          },
        };
      });
    };

    const handleFileDeleted = (fileName: string) => {
      if (!fileName) return;
      removeFileFromState(fileName);
      if (isPlaceholderFile(fileName)) {
        const folderPath = fileName.replace(`/${FOLDER_PLACEHOLDER}`, "");
        setActivity((prev) => [...prev, `Folder deleted: ${folderPath}`]);
        return;
      }
      setActivity((prev) => [...prev, `File deleted: ${fileName}`]);
    };

    const handleUsersUpdated = ({
      users: nextUsers,
    }: {
      users: Array<{ userId: string; displayName: string }>;
    }) => {
      setUsers(nextUsers);
      setActivity((prev) => [...prev, `Users updated: ${nextUsers.length}`]);
      const activeIds = new Set(nextUsers.map((user) => user.userId));
      setRemoteCursors((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((userId) => {
          if (!activeIds.has(userId)) {
            delete next[userId];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    const handleReceiveMessage = ({
      id,
      userId,
      displayName,
      message,
      clientMessageId,
      createdAt,
    }: {
      id?: string;
      userId: string;
      displayName: string;
      message: string;
      clientMessageId?: string;
      createdAt?: string;
    }) => {
      if (userId === currentUserId) {
        return;
      }
      const nextCreatedAt = createdAt ?? new Date().toISOString();
      upsertMessage({
        id: id ?? clientMessageId ?? `${userId}-${nextCreatedAt}`,
        clientMessageId,
        roomId: currentRoomId,
        userId,
        displayName,
        message,
        createdAt: nextCreatedAt,
      });
      setActivity((prev) => [...prev, `Message from ${userId}`]);
    };

    const handleFolderDeleted = ({ fileNames }: { fileNames: string[] }) => {
      if (!Array.isArray(fileNames) || fileNames.length === 0) return;
      removeFilesFromState(fileNames);
      setActivity((prev) => [
        ...prev,
        `Folder deleted (${fileNames.length} items)`,
      ]);
    };

    const handleFolderRenamed = ({
      entries,
    }: {
      entries: FolderRenameEntry[];
    }) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      applyFolderRename(entries);
      setActivity((prev) => [...prev, "Folder renamed"]);
    };

    socket.on("file-created", handleFileCreated);
    socket.on("code-update", handleCodeUpdate);
    socket.on("editor-cursor-update", handleEditorCursorUpdate);
    socket.on("file-deleted", handleFileDeleted);
    socket.on("users-updated", handleUsersUpdated);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("folder-deleted", handleFolderDeleted);
    socket.on("folder-renamed", handleFolderRenamed);

    return () => {
      socket.off("file-created", handleFileCreated);
      socket.off("code-update", handleCodeUpdate);
      socket.off("editor-cursor-update", handleEditorCursorUpdate);
      socket.off("file-deleted", handleFileDeleted);
      socket.off("users-updated", handleUsersUpdated);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("folder-deleted", handleFolderDeleted);
      socket.off("folder-renamed", handleFolderRenamed);
    };
  }, [
    socket,
    currentUserId,
    applyCodeUpdate,
    currentRoomId,
    upsertMessage,
    createFileEntry,
    roomDbId,
    scheduleAutoSave,
    removeFileFromState,
    syncLocalFileFromRecord,
    upsertFileRecord,
    applyFolderRename,
    removeFilesFromState,
  ]);

  useEffect(() => {
    if (!currentRoomId) return;
    setMessages([]);
    messagesRef.current = [];
    setFiles({});
    setOpenFiles([]);
    setActiveFile("");
    setRoomDbId("");
    setFilesError("");
    setChatLoadState("idle");
    setChatLoadError("");
    setRemoteCursors({});
    pendingSavesRef.current = {};
    lastLoadedRoomRef.current = "";
    autoLoadAttemptedRef.current = false;
    roomResolutionPromiseRef.current = null;
  }, [currentRoomId]);

  useEffect(() => {
    if (!currentRoomId || !currentUserId) return;
    if (autoLoadAttemptedRef.current) return;
    autoLoadAttemptedRef.current = true;
    void loadWorkspace();
    void hydrateChatHistoryFromRoom();
  }, [
    currentRoomId,
    currentUserId,
    hydrateChatHistoryFromRoom,
    loadWorkspace,
  ]);

  const handleSelectFile = (name: string) => {
    if (!(name in files) || isPlaceholderFile(name)) return;
    setActiveFile(name);
    if (!openFiles.includes(name)) {
      setOpenFiles((prev) => [...prev, name]);
    }
  };

  const handleDeleteFile = useCallback(
    (fileName: string) => {
      if (!fileName) return;
      const shouldDelete = window.confirm(
        `Delete "${fileName}"? This cannot be undone.`,
      );
      if (!shouldDelete) return;

      removeFileFromState(fileName);

      socket?.emit("file-deleted", {
        roomId: currentRoomId,
        fileName,
        userId: currentUserId,
        displayName: currentDisplayName,
      });

      if (roomDbId) {
        void (async () => {
          try {
            console.debug("Deleting filename", {
              roomId: roomDbId,
              fileName,
            });
            const { data, error } = await supabase
              .from("files")
              .delete()
              .eq("room_id", roomDbId)
              .eq("file_name", fileName)
              .select("id");
            if (error) {
              console.error("Supabase delete error", error);
              throw error;
            }
            console.debug("Delete query result", {
              deletedIds: data?.map((row) => row.id) ?? [],
            });
          } catch (error) {
            console.error("Failed to delete file", error);
            setActivity((prev) => [...prev, `File delete failed: ${fileName}`]);
          }
        })();
      }
    },
    [
      currentDisplayName,
      currentRoomId,
      currentUserId,
      removeFileFromState,
      roomDbId,
      socket,
    ],
  );

  const handleCreateFile = (parentPath?: string) => {
    if (!currentRoomId) return;
    const baseName = "untitled";
    const normalizedParent = parentPath ? normalizeFilePath(parentPath) : "";
    let index = 1;
    const getCandidate = (suffix: number) =>
      normalizedParent
        ? `${normalizedParent}/${baseName}-${suffix}`
        : `${baseName}-${suffix}`;
    while (getCandidate(index) in filesRef.current) {
      index += 1;
    }
    const suggestedLeaf = `${baseName}-${index}`;
    const input = window.prompt("Enter a filename", suggestedLeaf);
    if (input === null) {
      return;
    }
    const inputPath = normalizeFilePath(input);
    const name = normalizedParent
      ? inputPath.startsWith(`${normalizedParent}/`)
        ? inputPath
        : normalizeFilePath(`${normalizedParent}/${inputPath}`)
      : inputPath;
    if (!name) {
      setActivity((prev) => [...prev, "File creation failed: empty name"]);
      return;
    }
    if (name.endsWith("/")) {
      setActivity((prev) => [...prev, "File creation failed: invalid name"]);
      return;
    }
    if (isPlaceholderFile(name)) {
      setActivity((prev) => [...prev, "File creation failed: reserved name"]);
      return;
    }
    if (
      Object.keys(filesRef.current).some(
        (existing) => existing !== name && existing.startsWith(`${name}/`),
      )
    ) {
      setActivity((prev) => [
        ...prev,
        `File creation failed: ${name} conflicts with folder`,
      ]);
      return;
    }
    if (name in files) {
      setActivity((prev) => [...prev, `File creation failed: ${name} exists`]);
      return;
    }
    console.debug("Created filename", { fileName: name });
    const entry = createFileEntry(name, "");
    setFiles((prev) => {
      if (name in prev) return prev;
      return { ...prev, [name]: entry };
    });
    setActiveFile(name);
    setOpenFiles((prev) => (prev.includes(name) ? prev : [...prev, name]));
    socket?.emit("file-created", {
      roomId: currentRoomId,
      fileName: name,
      userId: currentUserId,
      displayName: currentDisplayName,
    });
    scheduleAutoSave(name, "");
    if (roomDbId) {
      void (async () => {
        try {
          const record = await upsertFileRecord(name, "");
          if (record) {
            syncLocalFileFromRecord(record);
          }
        } catch (error) {
          console.error("Failed to persist new file", error);
          setActivity((prev) => [...prev, `File save failed: ${name}`]);
        }
      })();
    }
  };

  const handleCreateFolder = useCallback(() => {
    if (!currentRoomId) return;
    const input = window.prompt("Enter a folder name", "src");
    if (input === null) {
      return;
    }
    const folderPath = normalizeFilePath(input);
    if (!folderPath) {
      setActivity((prev) => [...prev, "Folder creation failed: empty name"]);
      return;
    }
    if (folderPath.endsWith("/") || isPlaceholderFile(folderPath)) {
      setActivity((prev) => [...prev, "Folder creation failed: invalid name"]);
      return;
    }
    const existingNames = Object.keys(filesRef.current);
    if (existingNames.includes(folderPath)) {
      setActivity((prev) => [
        ...prev,
        `Folder creation failed: ${folderPath} conflicts with file`,
      ]);
      return;
    }
    if (existingNames.some((name) => name.startsWith(`${folderPath}/`))) {
      setActivity((prev) => [
        ...prev,
        `Folder creation failed: ${folderPath} exists`,
      ]);
      return;
    }
    const placeholderName = `${folderPath}/${FOLDER_PLACEHOLDER}`;
    if (placeholderName in filesRef.current) {
      setActivity((prev) => [
        ...prev,
        `Folder creation failed: ${folderPath} exists`,
      ]);
      return;
    }

    const entry = createFileEntry(placeholderName, "");
    setFiles((prev) => {
      if (placeholderName in prev) return prev;
      return { ...prev, [placeholderName]: entry };
    });
    setActivity((prev) => [...prev, `Folder created: ${folderPath}`]);
    socket?.emit("file-created", {
      roomId: currentRoomId,
      fileName: placeholderName,
      userId: currentUserId,
      displayName: currentDisplayName,
    });
    scheduleAutoSave(placeholderName, "");
    if (roomDbId) {
      void (async () => {
        try {
          const record = await upsertFileRecord(placeholderName, "");
          if (record) {
            syncLocalFileFromRecord(record);
          }
        } catch (error) {
          console.error("Failed to persist new folder", error);
          setActivity((prev) => [...prev, `Folder save failed: ${folderPath}`]);
        }
      })();
    }
  }, [
    createFileEntry,
    currentDisplayName,
    currentRoomId,
    currentUserId,
    normalizeFilePath,
    roomDbId,
    scheduleAutoSave,
    socket,
    syncLocalFileFromRecord,
    upsertFileRecord,
  ]);

  const handleDeleteFolder = useCallback(
    (folderPath: string) => {
      const normalized = normalizeFilePath(folderPath);
      if (!normalized) return;
      const prefix = `${normalized}/`;
      const fileNames = Object.keys(filesRef.current).filter((name) =>
        name.startsWith(prefix),
      );
      if (fileNames.length === 0) {
        setActivity((prev) => [...prev, `Folder not found: ${normalized}`]);
        return;
      }
      const shouldDelete = window.confirm(
        `Delete "${normalized}" and ${fileNames.length} item(s)? This cannot be undone.`,
      );
      if (!shouldDelete) return;

      removeFilesFromState(fileNames);
      setActivity((prev) => [...prev, `Folder deleted: ${normalized}`]);

      socket?.emit("folder-deleted", {
        roomId: currentRoomId,
        fileNames,
        userId: currentUserId,
        displayName: currentDisplayName,
      });

      if (roomDbId) {
        void (async () => {
          try {
            const { error } = await supabase
              .from("files")
              .delete()
              .eq("room_id", roomDbId)
              .in("file_name", fileNames);
            if (error) {
              throw error;
            }
          } catch (error) {
            console.error("Failed to delete folder files", error);
            setActivity((prev) => [
              ...prev,
              `Folder delete failed: ${normalized}`,
            ]);
          }
        })();
      }
    },
    [
      currentDisplayName,
      currentRoomId,
      currentUserId,
      normalizeFilePath,
      removeFilesFromState,
      roomDbId,
      socket,
    ],
  );

  const handleRenameFolder = useCallback(
    (folderPath: string) => {
      const normalized = normalizeFilePath(folderPath);
      if (!normalized) return;
      const currentName = normalized.split("/").pop() ?? normalized;
      const input = window.prompt("Rename folder", currentName);
      if (input === null) {
        return;
      }
      const nextPath = normalizeFilePath(input);
      if (!nextPath) {
        setActivity((prev) => [...prev, "Folder rename failed: empty name"]);
        return;
      }
      if (isPlaceholderFile(nextPath)) {
        setActivity((prev) => [...prev, "Folder rename failed: invalid name"]);
        return;
      }
      if (nextPath === normalized) {
        return;
      }
      const prefix = `${normalized}/`;
      const fileNames = Object.keys(filesRef.current).filter((name) =>
        name.startsWith(prefix),
      );
      if (fileNames.length === 0) {
        setActivity((prev) => [...prev, `Folder not found: ${normalized}`]);
        return;
      }
      const nextPrefix = `${nextPath}/`;
      const hasConflict = Object.keys(filesRef.current).some((name) => {
        if (name.startsWith(prefix)) return false;
        return name === nextPath || name.startsWith(nextPrefix);
      });
      if (hasConflict) {
        setActivity((prev) => [
          ...prev,
          `Folder rename failed: ${nextPath} exists`,
        ]);
        return;
      }

      const entries: FolderRenameEntry[] = fileNames.map((name) => {
        const entry = filesRef.current[name];
        return {
          from: name,
          to: `${nextPath}/${name.slice(prefix.length)}`,
          content: entry?.content ?? "",
          language: entry?.language ?? "plaintext",
          id: entry?.id,
          updatedAt: Date.now(),
        };
      });

      applyFolderRename(entries);
      setActivity((prev) => [
        ...prev,
        `Folder renamed: ${normalized} → ${nextPath}`,
      ]);

      socket?.emit("folder-renamed", {
        roomId: currentRoomId,
        entries,
        userId: currentUserId,
        displayName: currentDisplayName,
      });

      if (roomDbId) {
        void (async () => {
          try {
            const updatedAt = new Date().toISOString();
            await Promise.all(
              entries.map(async (entry) => {
                const query = supabase
                  .from("files")
                  .update({ file_name: entry.to, updated_at: updatedAt });
                const { error } = entry.id
                  ? await query.eq("id", entry.id)
                  : await query
                      .eq("room_id", roomDbId)
                      .eq("file_name", entry.from);
                if (error) {
                  throw error;
                }
              }),
            );
          } catch (error) {
            console.error("Failed to rename folder files", error);
            setActivity((prev) => [
              ...prev,
              `Folder rename failed: ${normalized}`,
            ]);
          }
        })();
      }
    },
    [
      applyFolderRename,
      currentDisplayName,
      currentRoomId,
      currentUserId,
      normalizeFilePath,
      roomDbId,
      socket,
    ],
  );

  const emitEditorCursor = useCallback(
    (payload: {
      fileName: string;
      lineNumber: number;
      column: number;
      isTyping?: boolean;
    }) => {
      if (!socket || !currentRoomId || !currentUserId || !currentDisplayName) {
        return;
      }
      if (!payload.fileName || payload.fileName !== activeFileRef.current) {
        return;
      }
      if (payload.lineNumber <= 0 || payload.column <= 0) return;

      const now = performance.now();
      const send = (data: typeof payload) => {
        cursorEmitRef.current.lastEmit = performance.now();
        socket.emit("editor-cursor-move", {
          roomId: currentRoomId,
          userId: currentUserId,
          displayName: currentDisplayName,
          fileName: data.fileName,
          lineNumber: data.lineNumber,
          column: data.column,
          isTyping: Boolean(data.isTyping),
        });
      };

      if (now - cursorEmitRef.current.lastEmit >= CURSOR_EMIT_INTERVAL_MS) {
        send(payload);
        return;
      }

      cursorEmitRef.current.pending = payload;
      if (cursorEmitRef.current.timer === null) {
        const wait = Math.max(
          CURSOR_EMIT_INTERVAL_MS - (now - cursorEmitRef.current.lastEmit),
          0,
        );
        cursorEmitRef.current.timer = window.setTimeout(() => {
          cursorEmitRef.current.timer = null;
          if (cursorEmitRef.current.pending) {
            send(cursorEmitRef.current.pending);
            cursorEmitRef.current.pending = null;
          }
        }, wait);
      }
    },
    [socket, currentRoomId, currentUserId, currentDisplayName],
  );

  const handleCodeChange = (fileName: string, code: string) => {
    if (!currentRoomId) return;
    setFiles((prev) => {
      const existing = prev[fileName];
      const nextEntry = existing
        ? { ...existing, content: code, updated_at: Date.now() }
        : createFileEntry(fileName, code);
      return { ...prev, [fileName]: nextEntry };
    });
    socket?.emit("code-change", {
      roomId: currentRoomId,
      fileName,
      code,
      userId: currentUserId,
      displayName: currentDisplayName,
    });
    scheduleAutoSave(fileName, code);
  };

  const handleCloseFile = (name: string) => {
    const newFiles = openFiles.filter((f) => f !== name);
    setOpenFiles(newFiles);
    if (activeFile === name) {
      setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1] : "");
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!currentUserId || !currentRoomId) return;
    const clientMessageId = createClientMessageId();
    const optimisticMessage: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      roomId: currentRoomId,
      userId: currentUserId,
      displayName: currentDisplayName,
      message,
      createdAt: new Date().toISOString(),
    };
    upsertMessage(optimisticMessage);

    try {
      const resolvedRoomId = roomDbId || (await ensureRoomDbId());
      if (!resolvedRoomId) {
        return;
      }

      const savedMessage = await saveRoomMessage(
        resolvedRoomId,
        currentUserId,
        currentDisplayName,
        message,
      );

      upsertMessage({
        id: savedMessage.id,
        clientMessageId,
        roomId: savedMessage.room_id ?? resolvedRoomId,
        userId: savedMessage.user_id ?? currentUserId,
        displayName: savedMessage.display_name ?? currentDisplayName,
        message: savedMessage.message,
        createdAt: savedMessage.created_at,
      });

      socket?.emit("send-message", {
        id: savedMessage.id,
        roomId: resolvedRoomId,
        userId: currentUserId,
        displayName: currentDisplayName,
        message: savedMessage.message,
        clientMessageId,
        createdAt: savedMessage.created_at,
      });
    } catch (error) {
      console.error("[supabase]", error);
    }
  };

  const createEmptyExecutionOutput = useCallback(
    (overrides: Partial<ExecutionOutput> = {}): ExecutionOutput => ({
      stdout: "",
      stderr: "",
      compileOutput: "",
      message: "",
      errorMessage: "",
      ...overrides,
    }),
    [],
  );

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    if (!activeFile) {
      setExecutionOutput(
        createEmptyExecutionOutput({ errorMessage: "Select a file to run." }),
      );
      setTerminalOpen(true);
      return;
    }
    const file = files[activeFile];
    const judge0Language = resolveJudge0Language(activeFile);
    if (!judge0Language) {
      setExecutionOutput(
        createEmptyExecutionOutput({
          errorMessage: `Unsupported file type for ${activeFile}.`,
          fileName: activeFile,
        }),
      );
      setTerminalOpen(true);
      return;
    }

    const code = file?.content ?? "";
    setIsRunning(true);
    setTerminalOpen(true);
    setExecutionOutput(
      createEmptyExecutionOutput({
        fileName: activeFile,
        language: judge0Language.label,
        languageId: judge0Language.id,
        status: "Submitting",
      }),
    );

    try {
      const response = await fetch(
        "https://ce.judge0.com/submissions?base64_encoded=false&wait=false",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            source_code: code,
            language_id: judge0Language.id,
            stdin: stdinValue ?? "",
          }),
        },
      );

      if (!response.ok) {
        let message = `Execution failed (${response.status})`;
        try {
          const errorPayload = (await response.json()) as { message?: string };
          if (errorPayload?.message) {
            message = errorPayload.message;
          }
        } catch (error) {
          console.error("Failed to parse execution error", error);
        }
        setExecutionOutput(
          createEmptyExecutionOutput({
            errorMessage: message,
            fileName: activeFile,
            language: judge0Language.label,
            languageId: judge0Language.id,
            status: "Failed",
          }),
        );
        return;
      }

      const submission = (await response.json()) as { token?: string };
      if (!submission.token) {
        setExecutionOutput(
          createEmptyExecutionOutput({
            errorMessage: "Submission failed: missing token.",
            fileName: activeFile,
            language: judge0Language.label,
            languageId: judge0Language.id,
            status: "Failed",
          }),
        );
        return;
      }

      const pollDelayMs = 750;
      const maxAttempts = 20;
      const sleep = (ms: number) =>
        new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), ms);
        });

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const pollResponse = await fetch(
          `https://ce.judge0.com/submissions/${submission.token}?base64_encoded=false`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!pollResponse.ok) {
          let message = `Execution failed (${pollResponse.status})`;
          try {
            const errorPayload = (await pollResponse.json()) as {
              message?: string;
            };
            if (errorPayload?.message) {
              message = errorPayload.message;
            }
          } catch (error) {
            console.error("Failed to parse execution error", error);
          }
          setExecutionOutput(
            createEmptyExecutionOutput({
              errorMessage: message,
              fileName: activeFile,
              language: judge0Language.label,
              languageId: judge0Language.id,
              status: "Failed",
            }),
          );
          return;
        }

        const result = (await pollResponse.json()) as {
          stdout?: string | null;
          stderr?: string | null;
          compile_output?: string | null;
          message?: string | null;
          status?: { id?: number | null; description?: string | null };
          time?: string | null;
          memory?: number | null;
        };

        const statusId = result.status?.id ?? null;
        const statusDescription = result.status?.description ?? "Running";

        if (statusId === 1 || statusId === 2) {
          setExecutionOutput(
            createEmptyExecutionOutput({
              fileName: activeFile,
              language: judge0Language.label,
              languageId: judge0Language.id,
              status: statusDescription,
              statusId,
            }),
          );
          await sleep(pollDelayMs);
          continue;
        }

        setExecutionOutput(
          createEmptyExecutionOutput({
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "",
            compileOutput: result.compile_output ?? "",
            message: result.message ?? "",
            fileName: activeFile,
            language: judge0Language.label,
            languageId: judge0Language.id,
            status: statusDescription,
            statusId,
            time: result.time ?? null,
            memory: result.memory ?? null,
          }),
        );
        return;
      }

      setExecutionOutput(
        createEmptyExecutionOutput({
          errorMessage: "Execution timed out. Please try again.",
          fileName: activeFile,
          language: judge0Language.label,
          languageId: judge0Language.id,
          status: "Timed out",
        }),
      );
    } catch (error) {
      console.error("Failed to execute code", error);
      setExecutionOutput(
        createEmptyExecutionOutput({
          errorMessage: "Execution failed. Please try again.",
          fileName: activeFile,
          language: judge0Language.label,
          languageId: judge0Language.id,
          status: "Failed",
        }),
      );
    } finally {
      setIsRunning(false);
    }
  }, [
    activeFile,
    createEmptyExecutionOutput,
    files,
    isRunning,
    resolveJudge0Language,
    stdinValue,
  ]);

  const activeLanguage = activeFile
    ? resolveLanguage(activeFile, files[activeFile]?.language)
    : "plaintext";
  const activeLanguageLabel = formatLanguageLabel(activeLanguage);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-60 border-r border-glass-border bg-card shrink-0 overflow-hidden">
          <FileExplorer
            files={files}
            activeFile={activeFile}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDeleteFile={handleDeleteFile}
            onLoadWorkspace={handleLoadWorkspace}
            isLoadingWorkspace={isLoadingFiles}
            loadErrorMessage={filesError}
          />
        </div>

        {/* Center Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              files={files}
              openFiles={openFiles}
              activeFile={activeFile}
              language={activeLanguage}
              languageLabel={activeLanguageLabel}
              remoteCursors={remoteCursors}
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
              onCodeChange={handleCodeChange}
              onCursorChange={emitEditorCursor}
              onRun={handleRun}
              isRunning={isRunning}
              roomId={currentRoomId}
              isLoading={isLoadingFiles}
            />
          </div>
          <TerminalPanel
            isOpen={terminalOpen}
            onToggle={() => setTerminalOpen(!terminalOpen)}
            output={executionOutput}
            isRunning={isRunning}
            stdin={stdinValue}
            onStdinChange={setStdinValue}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-60 border-l border-glass-border bg-card shrink-0 flex flex-col overflow-hidden">
          <ActiveUsers users={users} currentUserId={currentUserId} />
          <ChatPanel
            messages={messages}
            loadState={chatLoadState}
            loadErrorMessage={chatLoadError}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
