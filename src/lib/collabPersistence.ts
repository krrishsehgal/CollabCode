import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  message: string;
  createdAt: string;
};

export type CodeFile = {
  id: string;
  roomId: string;
  fileName: string;
  code: string;
  updatedAt: string;
  updatedBy: string | null;
};

type ChatMessageRow = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

type CodeFileRow = {
  id: string;
  room_id: string;
  file_name: string;
  code: string;
  updated_at: string;
  updated_by: string | null;
};

const mapMessageRow = (row: ChatMessageRow): ChatMessage => ({
  id: row.id,
  roomId: row.room_id,
  userId: row.user_id,
  displayName: row.display_name,
  message: row.content,
  createdAt: row.created_at,
});

const mapCodeFileRow = (row: CodeFileRow): CodeFile => ({
  id: row.id,
  roomId: row.room_id,
  fileName: row.file_name,
  code: row.code,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

export const fetchMessages = async (roomId: string) => {
  if (!roomId) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapMessageRow);
};

export const saveMessage = async ({
  roomId,
  userId,
  displayName,
  message,
}: {
  roomId: string;
  userId: string;
  displayName: string;
  message: string;
}) => {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      user_id: userId,
      display_name: displayName,
      content: message,
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return mapMessageRow(data as ChatMessageRow);
};

export const subscribeToMessages = (
  roomId: string,
  onMessage: (message: ChatMessage) => void,
): RealtimeChannel | null => {
  if (!roomId) return null;
  return supabase
    .channel(`room:${roomId}:messages`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const next = payload.new as ChatMessageRow;
        onMessage(mapMessageRow(next));
      },
    )
    .subscribe();
};

export const fetchCodeFiles = async (roomId: string) => {
  if (!roomId) return [];
  const { data, error } = await supabase
    .from("code_files")
    .select("*")
    .eq("room_id", roomId)
    .order("file_name", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(mapCodeFileRow);
};

export const saveCodeFile = async ({
  roomId,
  fileName,
  code,
  updatedBy,
}: {
  roomId: string;
  fileName: string;
  code: string;
  updatedBy: string | null;
}) => {
  const { data, error } = await supabase
    .from("code_files")
    .upsert(
      {
        room_id: roomId,
        file_name: fileName,
        code,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,file_name" },
    )
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return mapCodeFileRow(data as CodeFileRow);
};

export const subscribeToCodeFiles = (
  roomId: string,
  onChange: (codeFile: CodeFile) => void,
): RealtimeChannel | null => {
  if (!roomId) return null;
  return supabase
    .channel(`room:${roomId}:code-files`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "code_files",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const next = payload.new as CodeFileRow;
        onChange(mapCodeFileRow(next));
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "code_files",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const next = payload.new as CodeFileRow;
        onChange(mapCodeFileRow(next));
      },
    )
    .subscribe();
};
