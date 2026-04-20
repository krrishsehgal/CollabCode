import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useParams } from "react-router-dom";

export const SocketExample = () => {
  const { roomId } = useParams();
  const socket = useSocket({
    roomId,
    userId: "current-user-id", // Replace with actual user ID from your auth context/state
    displayName: "Current User", // Replace with actual display name from your auth context/state
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
