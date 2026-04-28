require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// In-memory room structure: roomId -> [{ userId, displayName }]
const roomUsers = {};
// Track socket to user mapping: socketId -> { userId, displayName, roomId }
const socketUsers = {};

// Enable CORS for frontend
const corsOptions = {
  origin: "http://localhost:8080",
  credentials: true,
  methods: ["GET", "POST"],
};

app.use(cors(corsOptions));

// Attach Socket.io to server
const io = new Server(server, {
  cors: corsOptions,
});

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Server running");
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle join-room event
  socket.on("join-room", (data) => {
    const { roomId, userId, displayName } = data;

    // Add socket to room
    socket.join(roomId);

    // Initialize room user list if it doesn't exist
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }

    // Add user to room if not already present
    if (!roomUsers[roomId].some((user) => user.userId === userId)) {
      roomUsers[roomId].push({ userId, displayName });
    } else {
      roomUsers[roomId] = roomUsers[roomId].map((user) =>
        user.userId === userId ? { userId, displayName } : user
      );
    }
    socketUsers[socket.id] = { userId, displayName, roomId };

    console.log(`User ${userId} joined room ${roomId}`);

    // Broadcast active users in this room
    io.to(roomId).emit("users-updated", { users: roomUsers[roomId] });
  });

  // Handle collaborative code changes
  socket.on("code-change", (data) => {
    const { roomId, fileName, code } = data;
    socket.to(roomId).emit("code-update", { fileName, code });
  });

  // Handle collaborative file creation
  socket.on("file-created", (data) => {
    const { roomId, fileName } = data;
    socket.to(roomId).emit("file-created", fileName);
    console.log(`File created: ${fileName} in room ${roomId}`);
  });

  // Handle chat messages
  socket.on("send-message", (data) => {
    const { roomId, userId, displayName, message, clientMessageId } = data;
    io
      .to(roomId)
      .emit("receive-message", { userId, displayName, message, clientMessageId });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const userData = socketUsers[socket.id];

    if (userData) {
      const { userId, roomId } = userData;
      
      // Remove user from room
      if (roomUsers[roomId]) {
        roomUsers[roomId] = roomUsers[roomId].filter((user) => user.userId !== userId);

        // Broadcast active users in this room
        io.to(roomId).emit("users-updated", { users: roomUsers[roomId] });

        // Clean up empty room
        if (roomUsers[roomId].length === 0) {
          delete roomUsers[roomId];
        }

        console.log(`User ${userId} left room ${roomId}`);
      }
    }

    delete socketUsers[socket.id];
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
