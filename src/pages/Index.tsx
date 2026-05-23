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
type ChatMessage = {
  id: string;
  clientMessageId?: string;
  roomId: string;
  userId: string;
  displayName: string;
  message: string;
  createdAt: string;
};

type FileEntry = {
  id: string;
  name: string;
  content: string;
  room_id: string;
  created_at: number;
  updated_at: number;
  language: string;
};

const Index = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const currentRoomId = roomId || "";
  const identityDisplayName = user?.identities?.find((identity) => {
    const displayName = identity.identity_data?.display_name;
    return typeof displayName === "string" && displayName.trim().length > 0;
  })?.identity_data?.display_name as string | undefined;
  const currentDisplayName =
    identityDisplayName?.trim() ||
    (typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "") ||
    (typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "") ||
    user?.email ||
    (user?.id ? user.id.slice(0, 6) : "");
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
  const [hasLoadedWorkspace, setHasLoadedWorkspace] = useState(false);
  const [users, setUsers] = useState<
    Array<{ userId: string; displayName: string }>
  >([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const filesRef = useRef<Record<string, FileEntry>>({});
  const saveTimersRef = useRef<Record<string, number>>({});
  const pendingSavesRef = useRef<Record<string, string>>({});
  const activeFileRef = useRef(activeFile);
  const lastLoadedRoomRef = useRef("");
  const autoLoadAttemptedRef = useRef(false);
  const autoLoadOnOpen = false;
  const storageKeys = {
    messages: currentRoomId ? `messages:${currentRoomId}` : "",
    files: currentRoomId ? `files:${currentRoomId}` : "",
  };
  const createClientMessageId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };
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
      case "json":
        return "json";
      case "html":
        return "html";
      case "css":
        return "css";
      case "md":
        return "markdown";
      default:
        return "plaintext";
    }
  }, []);
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
      language: overrides.language ?? inferLanguageFromFileName(name),
    }),
    [createFileId, currentRoomId, inferLanguageFromFileName, roomDbId],
  );
  const persistMessages = useCallback(
    (nextMessages: ChatMessage[]) => {
      if (!storageKeys.messages || typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(
          storageKeys.messages,
          JSON.stringify(nextMessages),
        );
      } catch (error) {
        console.error("Failed to cache messages", error);
      }
    },
    [storageKeys.messages],
  );
  const persistFiles = useCallback(
    (nextFiles: Record<string, FileEntry>) => {
      if (!storageKeys.files || typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(storageKeys.files, JSON.stringify(nextFiles));
      } catch (error) {
        console.error("Failed to cache files", error);
      }
    },
    [storageKeys.files],
  );

  const readLocalMessages = useCallback((): ChatMessage[] => {
    if (!storageKeys.messages || typeof localStorage === "undefined") {
      return [];
    }
    try {
      const raw = localStorage.getItem(storageKeys.messages);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ChatMessage[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to read cached messages", error);
      return [];
    }
  }, [storageKeys.messages]);

  const readLocalFiles = useCallback((): Record<string, FileEntry> => {
    if (!storageKeys.files || typeof localStorage === "undefined") {
      return {};
    }
    try {
      const raw = localStorage.getItem(storageKeys.files);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, FileEntry | string>;
      if (!parsed || typeof parsed !== "object") return {};
      const next: Record<string, FileEntry> = {};
      Object.entries(parsed).forEach(([name, value]) => {
        if (typeof value === "string") {
          next[name] = createFileEntry(name, value);
          return;
        }
        if (value && typeof value === "object") {
          const file = value as Partial<FileEntry>;
          const normalizedName =
            typeof file.name === "string" && file.name.trim().length > 0
              ? file.name
              : name;
          next[normalizedName] = createFileEntry(
            normalizedName,
            typeof file.content === "string" ? file.content : "",
            {
              id: typeof file.id === "string" ? file.id : undefined,
              room_id:
                typeof file.room_id === "string" ? file.room_id : undefined,
              created_at:
                typeof file.created_at === "number"
                  ? file.created_at
                  : undefined,
              updated_at:
                typeof file.updated_at === "number"
                  ? file.updated_at
                  : undefined,
              language:
                typeof file.language === "string" ? file.language : undefined,
            },
          );
        }
      });
      return next;
    } catch (error) {
      console.error("Failed to read cached files", error);
      return {};
    }
  }, [createFileEntry, storageKeys.files]);

  const normalizeMessage = useCallback(
    (message: ChatMessage) => ({
      ...message,
      displayName:
        message.userId === currentUserId ? "You" : message.displayName,
    }),
    [currentUserId],
  );

  const upsertMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => {
        const matchIndex = prev.findIndex(
          (item) =>
            item.id === message.id ||
            (message.clientMessageId &&
              item.clientMessageId === message.clientMessageId),
        );
        const normalized = normalizeMessage(message);
        if (matchIndex >= 0) {
          const next = [...prev];
          next[matchIndex] = { ...next[matchIndex], ...normalized };
          next.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          persistMessages(next);
          return next;
        }
        const next = [...prev, normalized];
        next.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        persistMessages(next);
        return next;
      });
    },
    [normalizeMessage, persistMessages],
  );

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  const hydrateFilesFromRoom = useCallback(
    async (roomCode: string, userId: string) => {
      setIsLoadingFiles(true);
      setFilesError("");
      try {
        const { data: existingRoom, error: roomError } = await supabase
          .from("rooms")
          .select("id, room_code")
          .eq("room_code", roomCode)
          .maybeSingle();

        if (roomError) {
          throw roomError;
        }

        let resolvedRoomId = existingRoom?.id ?? "";
        if (!resolvedRoomId) {
          const { data: newRoom, error: createRoomError } = await supabase
            .from("rooms")
            .insert({
              room_code: roomCode,
              created_by: userId,
            })
            .select("id, room_code")
            .single();

          if (createRoomError) {
            throw createRoomError;
          }

          resolvedRoomId = newRoom.id;
          console.debug("Resolved room (created)", {
            roomCode,
            roomId: resolvedRoomId,
          });
        } else {
          console.debug("Resolved room", {
            roomCode: existingRoom?.room_code ?? roomCode,
            roomId: resolvedRoomId,
          });
        }

        setRoomDbId(resolvedRoomId);

        const { data: remoteFiles, error: filesError } = await supabase
          .from("files")
          .select("id, room_id, file_name, language, content, updated_at")
          .eq("room_id", resolvedRoomId)
          .order("updated_at", { ascending: true });

        if (filesError) {
          throw filesError;
        }

        console.debug("Fetched files", {
          roomId: resolvedRoomId,
          count: remoteFiles?.length ?? 0,
          files: remoteFiles?.map((file) => file.file_name),
        });
        console.debug("Fetched DB rows", remoteFiles ?? []);

        const contentByName: Record<string, string> = {};
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

        (remoteFiles ?? []).forEach((file) => {
          const originalName = file.file_name || "untitled";
          const fileName = ensureUniqueName(originalName);
          usedNames.add(fileName);
          const content = file.content ?? "";
          const updatedAt = file.updated_at
            ? new Date(file.updated_at).getTime()
            : Date.now();
          contentByName[fileName] = content;
          nextFiles[fileName] = createFileEntry(fileName, content, {
            id: file.id,
            room_id: file.room_id,
            language: file.language ?? inferLanguageFromFileName(fileName),
            created_at: updatedAt,
            updated_at: updatedAt,
          });
        });

        console.debug("Final files object before setFiles", contentByName);
        console.debug("Files state update", {
          roomId: resolvedRoomId,
          fileCount: Object.keys(nextFiles).length,
        });

        setFiles(nextFiles);
        persistFiles(nextFiles);

        const fileNames = Object.keys(nextFiles);
        const currentActive = activeFileRef.current;
        const nextActive = fileNames.includes(currentActive)
          ? currentActive
          : fileNames[0] ?? "";
        setActiveFile(nextActive);
        setOpenFiles((prev) => {
          const filtered = prev.filter((name) => name in nextFiles);
          if (nextActive && !filtered.includes(nextActive)) {
            return [...filtered, nextActive];
          }
          return filtered;
        });
        return true;
      } catch (error) {
        console.error("Failed to load files from Supabase", error);
        setFilesError("Failed to load files from Supabase.");
        setActivity((prev) => [...prev, "File sync error: load failed"]);
        return false;
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [createFileEntry, inferLanguageFromFileName, persistFiles],
  );

  const loadWorkspace = useCallback(
    async (options?: { force?: boolean }) => {
      if (!currentRoomId || !currentUserId) return;
      if (isLoadingFiles) return;
      if (!options?.force && lastLoadedRoomRef.current === currentRoomId) {
        return;
      }
      const didLoad = await hydrateFilesFromRoom(currentRoomId, currentUserId);
      if (didLoad) {
        lastLoadedRoomRef.current = currentRoomId;
        setHasLoadedWorkspace(true);
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
          language: record.language ?? prev[fileName].language,
          updated_at: updatedAt,
        };
        const next = { ...prev, [fileName]: nextEntry };
        persistFiles(next);
        return next;
      });
    },
    [persistFiles],
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

  const removeFileFromState = useCallback(
    (fileName: string) => {
      const currentFiles = filesRef.current;
      if (!fileName || !(fileName in currentFiles)) return;
      const { [fileName]: _, ...nextFiles } = currentFiles;
      filesRef.current = nextFiles;
      persistFiles(nextFiles);
      setFiles(nextFiles);

      const remainingNames = Object.keys(nextFiles);
      const currentActive = activeFileRef.current;
      const nextActive = remainingNames.includes(currentActive)
        ? currentActive
        : remainingNames[0] ?? "";
      setActiveFile(nextActive);
      setOpenFiles((prev) => {
        const filtered = prev.filter((name) => name in nextFiles);
        if (nextActive && !filtered.includes(nextActive)) {
          return [...filtered, nextActive];
        }
        return filtered;
      });

      const timer = saveTimersRef.current[fileName];
      if (timer) {
        window.clearTimeout(timer);
        delete saveTimersRef.current[fileName];
      }
      if (fileName in pendingSavesRef.current) {
        delete pendingSavesRef.current[fileName];
      }
    },
    [persistFiles],
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
        const next = { ...prev, [fileName]: nextEntry };
        persistFiles(next);
        return next;
      });
      if (nextActivity) {
        setActivity((prev) => [...prev, nextActivity]);
      }
      scheduleAutoSave(fileName, code);
    },
    [createFileEntry, persistFiles, scheduleAutoSave],
  );

  useEffect(() => {
    if (!socket) return;

    const handleFileCreated = (fileName: string) => {
      if (!fileName) return;
      setFiles((prev) => {
        if (fileName in prev) return prev;
        const next = { ...prev, [fileName]: createFileEntry(fileName, "") };
        persistFiles(next);
        return next;
      });
      setActivity((prev) => [...prev, `File created: ${fileName}`]);
      scheduleAutoSave(fileName, "");
      if (roomDbId) {
        void (async () => {
          try {
            const record = await upsertFileRecord(fileName, "");
            if (record) {
              syncLocalFileFromRecord(record);
            }
          } catch (error) {
            console.error("Failed to sync new file", error);
          }
        })();
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

    const handleFileDeleted = (fileName: string) => {
      if (!fileName) return;
      removeFileFromState(fileName);
      setActivity((prev) => [...prev, `File deleted: ${fileName}`]);
    };

    const handleUsersUpdated = ({
      users: nextUsers,
    }: {
      users: Array<{ userId: string; displayName: string }>;
    }) => {
      setUsers(nextUsers);
      setActivity((prev) => [...prev, `Users updated: ${nextUsers.length}`]);
    };

    const handleReceiveMessage = ({
      userId,
      displayName,
      message,
      clientMessageId,
    }: {
      userId: string;
      displayName: string;
      message: string;
      clientMessageId?: string;
    }) => {
      if (userId === currentUserId) {
        return;
      }
      const createdAt = new Date().toISOString();
      upsertMessage({
        id: clientMessageId ?? `${userId}-${createdAt}`,
        clientMessageId,
        roomId: currentRoomId,
        userId,
        displayName,
        message,
        createdAt,
      });
      setActivity((prev) => [...prev, `Message from ${userId}`]);
    };

    socket.on("file-created", handleFileCreated);
    socket.on("code-update", handleCodeUpdate);
    socket.on("file-deleted", handleFileDeleted);
    socket.on("users-updated", handleUsersUpdated);
    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("file-created", handleFileCreated);
      socket.off("code-update", handleCodeUpdate);
      socket.off("file-deleted", handleFileDeleted);
      socket.off("users-updated", handleUsersUpdated);
      socket.off("receive-message", handleReceiveMessage);
    };
  }, [
    socket,
    currentUserId,
    applyCodeUpdate,
    currentRoomId,
    upsertMessage,
    createFileEntry,
    persistFiles,
    roomDbId,
    scheduleAutoSave,
    removeFileFromState,
    syncLocalFileFromRecord,
    upsertFileRecord,
  ]);

  useEffect(() => {
    if (!currentRoomId) return;
    setMessages([]);
    setFiles({});
    setOpenFiles([]);
    setActiveFile("");
    setRoomDbId("");
    setFilesError("");
    setHasLoadedWorkspace(false);
    pendingSavesRef.current = {};
    lastLoadedRoomRef.current = "";
    autoLoadAttemptedRef.current = false;

    const cachedMessages = readLocalMessages();
    if (cachedMessages.length > 0) {
      setMessages(cachedMessages.map(normalizeMessage));
    }

    const cachedFiles = readLocalFiles();
    const fileNames = Object.keys(cachedFiles);
    const firstFile = fileNames[0] ?? "";
    setFiles(cachedFiles);
    setOpenFiles(firstFile ? [firstFile] : []);
    setActiveFile(firstFile);
  }, [currentRoomId, normalizeMessage, readLocalFiles, readLocalMessages]);

  useEffect(() => {
    if (!autoLoadOnOpen) return;
    if (!currentRoomId || !currentUserId) return;
    if (autoLoadAttemptedRef.current || hasLoadedWorkspace) return;
    autoLoadAttemptedRef.current = true;
    void loadWorkspace();
  }, [
    autoLoadOnOpen,
    currentRoomId,
    currentUserId,
    hasLoadedWorkspace,
    loadWorkspace,
  ]);

  useEffect(() => {
    if (!currentRoomId) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === storageKeys.messages) {
        const nextMessages = readLocalMessages();
        setMessages(nextMessages.map(normalizeMessage));
        return;
      }
      if (event.key === storageKeys.files) {
        const nextFiles = readLocalFiles();
        const fileNames = Object.keys(nextFiles);
        const nextActive = fileNames.includes(activeFile)
          ? activeFile
          : (fileNames[0] ?? "");
        setFiles(nextFiles);
        setActiveFile(nextActive);
        setOpenFiles((prev) => {
          const filtered = prev.filter((name) => name in nextFiles);
          if (nextActive && !filtered.includes(nextActive)) {
            return [...filtered, nextActive];
          }
          return filtered;
        });
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [
    activeFile,
    currentRoomId,
    normalizeMessage,
    readLocalFiles,
    readLocalMessages,
    storageKeys.files,
    storageKeys.messages,
  ]);

  const handleSelectFile = (name: string) => {
    if (!(name in files)) return;
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

  const handleCreateFile = () => {
    if (!currentRoomId) return;
    const baseName = "untitled";
    let index = 1;
    while (`${baseName}-${index}` in files) {
      index += 1;
    }
    const suggestedName = `${baseName}-${index}`;
    const input = window.prompt("Enter a filename", suggestedName);
    if (input === null) {
      return;
    }
    const name = input.trim();
    if (!name) {
      setActivity((prev) => [...prev, "File creation failed: empty name"]);
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
      const next = { ...prev, [name]: entry };
      persistFiles(next);
      return next;
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

  const handleCodeChange = (fileName: string, code: string) => {
    if (!currentRoomId) return;
    setFiles((prev) => {
      const existing = prev[fileName];
      const nextEntry = existing
        ? { ...existing, content: code, updated_at: Date.now() }
        : createFileEntry(fileName, code);
      const next = { ...prev, [fileName]: nextEntry };
      persistFiles(next);
      return next;
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
    socket?.emit("send-message", {
      roomId: currentRoomId,
      userId: currentUserId,
      displayName: currentDisplayName,
      message,
      clientMessageId,
    });
  };

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
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
              onCodeChange={handleCodeChange}
              roomId={currentRoomId}
              isLoading={isLoadingFiles}
            />
          </div>
          <TerminalPanel
            isOpen={terminalOpen}
            onToggle={() => setTerminalOpen(!terminalOpen)}
            activity={activity}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-60 border-l border-glass-border bg-card shrink-0 flex flex-col overflow-hidden">
          <ActiveUsers users={users} currentUserId={currentUserId} />
          <ChatPanel messages={messages} onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
};

export default Index;
