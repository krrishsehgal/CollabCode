import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  roomId?: string;
  userId?: string;
}

export const useSocket = (options?: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const { roomId = 'room-123', userId = '' } = options || {};

  // 🔥 Create socket ONLY ONCE
  useEffect(() => {
    if (socketRef.current) return;

    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });

    socketRef.current.on('user-joined', (data) => {
      console.log(`User joined: ${data.userId}`);
    });

    socketRef.current.on('user-left', (data) => {
      console.log(`User left: ${data.userId}`);
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []); // ❗ NO dependencies

  // 🔥 Emit join-room separately when userId is ready
  useEffect(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('join-room', { roomId, userId });
      console.log(`Emitted join-room: roomId=${roomId}, userId=${userId}`);
    }
  }, [roomId, userId]);

  return socketRef.current;
};