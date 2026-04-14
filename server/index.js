require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// In-memory room structure: roomId -> [userId1, userId2, ...]
const rooms = {};
// Track socket to user mapping: socketId -> { userId, roomId }
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
    const { roomId, userId } = data;

    // Add socket to room
    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    // Add user to room
    rooms[roomId].push(userId);
    socketUsers[socket.id] = { userId, roomId };

    console.log(`User ${userId} joined room ${roomId}`);

    // Broadcast to others in the room
    socket.to(roomId).emit("user-joined", { userId });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const userData = socketUsers[socket.id];

    if (userData) {
      const { userId, roomId } = userData;

      // Remove user from room
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter((id) => id !== userId);

        // Clean up empty room
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }

        // Broadcast to others in the room
        io.to(roomId).emit("user-left", { userId });

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
