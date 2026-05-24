import { useEffect, useRef, useState } from "react";
import { useMatch } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { getDisplayName } from "@/lib/user";

const DOT_SIZE = 6;
const RING_SIZE = 24;
const RING_LERP = 0.2;
const EMIT_INTERVAL_MS = 40;
const REMOTE_DOT_SIZE = 8;

type RemoteCursor = {
  userId: string;
  displayName: string;
  x: number;
  y: number;
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

export const CursorTracker = () => {
  const match = useMatch("/editor/:roomId");
  const { user } = useAuth();
  const currentRoomId =
    typeof match?.params?.roomId === "string" ? match.params.roomId : "";
  const currentDisplayName = getDisplayName(user);
  const currentUserId = user?.id ?? "";
  const socket = useSocket({
    roomId: currentRoomId,
    userId: currentUserId,
    displayName: currentDisplayName,
  });
  const canSync = Boolean(
    socket && currentRoomId && currentUserId && currentDisplayName,
  );
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const visible = useRef(false);
  const [remoteCursors, setRemoteCursors] = useState<
    Record<string, RemoteCursor>
  >({});
  const debugLogEnabled = import.meta.env.DEV;
  const lastEmitLogRef = useRef(0);

  useEffect(() => {
    if (!debugLogEnabled) return;
    console.debug("[cursor-sync] identity", {
      roomId: currentRoomId,
      userId: currentUserId,
      displayName: currentDisplayName,
      canSync,
    });
  }, [debugLogEnabled, currentRoomId, currentUserId, currentDisplayName, canSync]);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let emitTimer: number | null = null;
    let pendingPosition: { x: number; y: number } | null = null;
    let lastEmit = 0;

    const setVisibility = (isVisible: boolean) => {
      const opacity = isVisible ? "1" : "0";
      dot.style.opacity = opacity;
      ring.style.opacity = opacity;
    };

    const emitMove = (x: number, y: number) => {
      if (!canSync || !socket) return;
      const now = performance.now();
      const send = (payload: { x: number; y: number }) => {
        lastEmit = performance.now();
        if (debugLogEnabled && now - lastEmitLogRef.current > 1000) {
          lastEmitLogRef.current = now;
          console.debug("[cursor-sync] emit", {
            roomId: currentRoomId,
            userId: currentUserId,
            x: payload.x,
            y: payload.y,
          });
        }
        socket.emit("cursor-move", {
          roomId: currentRoomId,
          userId: currentUserId,
          displayName: currentDisplayName,
          x: payload.x,
          y: payload.y,
        });
      };

      if (now - lastEmit >= EMIT_INTERVAL_MS) {
        send({ x, y });
        return;
      }

      pendingPosition = { x, y };
      if (emitTimer === null) {
        const wait = Math.max(EMIT_INTERVAL_MS - (now - lastEmit), 0);
        emitTimer = window.setTimeout(() => {
          emitTimer = null;
          if (pendingPosition) {
            send(pendingPosition);
            pendingPosition = null;
          }
        }, wait);
      }
    };

    const emitLeave = () => {
      if (!canSync || !socket) return;
      socket.emit("cursor-leave", {
        roomId: currentRoomId,
        userId: currentUserId,
      });
      if (debugLogEnabled) {
        console.debug("[cursor-sync] leave", {
          roomId: currentRoomId,
          userId: currentUserId,
        });
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        if (visible.current) {
          visible.current = false;
          setVisibility(false);
          emitLeave();
        }
        return;
      }

      target.current.x = event.clientX;
      target.current.y = event.clientY;
      emitMove(event.clientX, event.clientY);

      if (!visible.current) {
        visible.current = true;
        current.current = { x: event.clientX, y: event.clientY };
        setVisibility(true);
      }
    };

    const handlePointerLeave = () => {
      if (!visible.current) return;
      visible.current = false;
      setVisibility(false);
      emitLeave();
    };

    const animate = () => {
      const { x, y } = target.current;
      const currentPos = current.current;

      currentPos.x += (x - currentPos.x) * RING_LERP;
      currentPos.y += (y - currentPos.y) * RING_LERP;

      dot.style.transform = `translate3d(${x - DOT_SIZE / 2}px, ${y - DOT_SIZE / 2}px, 0)`;
      ring.style.transform = `translate3d(${currentPos.x - RING_SIZE / 2}px, ${currentPos.y - RING_SIZE / 2}px, 0)`;

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (emitTimer !== null) window.clearTimeout(emitTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
    };
  }, [canSync, socket, currentRoomId, currentUserId, currentDisplayName]);

  useEffect(() => {
    if (!socket) return;

    const handleCursorUpdate = (payload: RemoteCursor) => {
      if (!payload?.userId) return;
      if (payload.userId === currentUserId) return;
      if (typeof payload.x !== "number" || typeof payload.y !== "number") return;
      if (debugLogEnabled) {
        console.debug("[cursor-sync] receive", payload);
      }
      const displayName =
        typeof payload.displayName === "string" && payload.displayName.trim()
          ? payload.displayName
          : payload.userId.slice(0, 6);
      setRemoteCursors((prev) => {
        const existing = prev[payload.userId];
        if (
          existing &&
          existing.x === payload.x &&
          existing.y === payload.y &&
          existing.displayName === displayName
        ) {
          return prev;
        }
        return {
          ...prev,
          [payload.userId]: {
            userId: payload.userId,
            displayName,
            x: payload.x,
            y: payload.y,
          },
        };
      });
    };

    const handleCursorLeft = ({ userId }: { userId: string }) => {
      if (!userId) return;
      setRemoteCursors((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleUsersUpdated = ({
      users,
    }: {
      users: Array<{ userId: string }>;
    }) => {
      if (!Array.isArray(users)) return;
      const active = new Set(users.map((item) => item.userId));
      setRemoteCursors((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((userId) => {
          if (!active.has(userId)) {
            delete next[userId];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    socket.on("cursor-update", handleCursorUpdate);
    socket.on("cursor-left", handleCursorLeft);
    socket.on("users-updated", handleUsersUpdated);

    return () => {
      socket.off("cursor-update", handleCursorUpdate);
      socket.off("cursor-left", handleCursorLeft);
      socket.off("users-updated", handleUsersUpdated);
    };
  }, [socket, currentUserId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true">
      {Object.values(remoteCursors).map((cursor) => {
        const color = getCursorColor(cursor.userId);
        return (
          <div
            key={cursor.userId}
            className="absolute left-0 top-0 flex flex-col items-start"
            style={{
              transform: `translate3d(${cursor.x - REMOTE_DOT_SIZE / 2}px, ${cursor.y - REMOTE_DOT_SIZE / 2}px, 0)`,
            }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}`,
              }}
            />
            <div
              className="mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-background"
              style={{
                backgroundColor: color,
              }}
            >
              {cursor.displayName}
            </div>
          </div>
        );
      })}
      <div
        ref={ringRef}
        className="absolute left-0 top-0 h-6 w-6 rounded-full border border-neon-blue/60 opacity-0 shadow-[0_0_12px_hsl(var(--neon-blue)/0.35)] transition-opacity duration-150"
      />
      <div
        ref={dotRef}
        className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-neon-purple opacity-0 shadow-[0_0_10px_hsl(var(--neon-purple)/0.6)] transition-opacity duration-150"
      />
    </div>
  );
};
