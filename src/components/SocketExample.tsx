import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";

export const SocketExample = () => {
  const socket = useSocket({
    roomId: "room-123",
    userId: "current-user-id", // Replace with actual user ID from your auth context/state
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log("Socket connected");
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  return (
    <div className="p-4">
      <h2>Socket.io Connection Status</h2>
      <p>
        Status:{" "}
        <span className={isConnected ? "text-green-600" : "text-red-600"}>
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </p>
    </div>
  );
};
