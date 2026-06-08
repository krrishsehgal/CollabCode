import { supabase } from "@/lib/supabase";
import type { Tables } from "@/integrations/supabase/types";

export type RoomRecord = Tables<"rooms">;
export type FileRecord = Tables<"files">;
export type MessageRecord = Tables<"messages">;

const ROOM_SELECT = "id, room_code, created_by, created_at";
const FILE_SELECT = "id, room_id, file_name, language, content, updated_at";
const MESSAGE_SELECT = "id, room_id, user_id, display_name, message, created_at";

export const resolveRoomRecord = async (
  roomCode: string,
  userId: string,
): Promise<RoomRecord> => {
  const { data: existingRoom, error: roomError } = await supabase
    .from("rooms")
    .select(ROOM_SELECT)
    .eq("room_code", roomCode)
    .maybeSingle();

  if (roomError && !existingRoom) {
    throw roomError;
  }

  if (existingRoom) {
    return existingRoom;
  }

  const { data: createdRoom, error: createError } = await supabase
    .from("rooms")
    .insert({
      room_code: roomCode,
      created_by: userId,
    })
    .select(ROOM_SELECT)
    .single();

  if (createError && !createdRoom) {
    const { data: fallbackRoom, error: fallbackError } = await supabase
      .from("rooms")
      .select(ROOM_SELECT)
      .eq("room_code", roomCode)
      .maybeSingle();

    if (fallbackError) {
      throw fallbackError;
    }

    if (fallbackRoom) {
      return fallbackRoom;
    }

    throw createError;
  }

  return createdRoom;
};

export const loadRoomFiles = async (roomId: string): Promise<FileRecord[]> => {
  const { data, error } = await supabase
    .from("files")
    .select(FILE_SELECT)
    .eq("room_id", roomId)
    .order("updated_at", { ascending: true });

  if (error && !data) {
    throw error;
  }

  return data ?? [];
};

export const loadRoomMessages = async (
  roomId: string,
): Promise<MessageRecord[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error && !data) {
    throw error;
  }

  return data ?? [];
};

export const saveRoomMessage = async (
  roomId: string,
  userId: string,
  displayName: string,
  message: string,
): Promise<MessageRecord> => {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      user_id: userId,
      display_name: displayName,
      message,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error && !data) {
    throw error;
  }

  return data;
};
