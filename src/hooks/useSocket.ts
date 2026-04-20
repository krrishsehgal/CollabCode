import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  roomId?: string;
  userId?: string;
  displayName?: string;
}

export const useSocket = (options?: UseSocketOptions) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { roomId, userId, displayName } = options || {};
  const hasValidIdentity = Boolean(
    roomId &&
    roomId.trim() &&
    userId &&
    userId.trim() &&
    displayName &&
    displayName.trim(),
  );
  const joinKey = hasValidIdentity ? `${roomId}:${userId}` : null;

  type SocketStore = {
    socket?: Socket;
    joinedRooms?: Set<string>;
  };
  const socketStore = globalThis as typeof globalThis & { __collabSocketStore?: SocketStore };
  if (!socketStore.__collabSocketStore) {
    socketStore.__collabSocketStore = { joinedRooms: new Set<string>() };
  }
  const sharedStore = socketStore.__collabSocketStore;

  // Create socket only when userId is valid
  useEffect(() => {
    if (!hasValidIdentity) {
      setSocket(null);
      return;
    }

    if (!sharedStore.socket) {
      sharedStore.socket = io('http://localhost:5000');

      sharedStore.socket.on('connect', () => {
        console.log('Connected to socket server');
      });

      sharedStore.socket.on('disconnect', () => {
        console.log('Disconnected from socket server');
      });

      sharedStore.socket.on('user-joined', (data) => {
        console.log(`User joined: ${data.userId}`);
      });

      sharedStore.socket.on('user-left', (data) => {
        console.log(`User left: ${data.userId}`);
      });
    }

    setSocket(sharedStore.socket);
  }, [hasValidIdentity, sharedStore]);

  // Emit join-room only once per room/user pair
  useEffect(() => {
    if (socket && joinKey && !sharedStore.joinedRooms?.has(joinKey)) {
      socket.emit('join-room', { roomId, userId, displayName });
      sharedStore.joinedRooms?.add(joinKey);
      console.log(`Emitted join-room: roomId=${roomId}, userId=${userId}, displayName=${displayName}`);
    }
  }, [socket, roomId, userId, displayName, joinKey, sharedStore]);

  return socket;
};
