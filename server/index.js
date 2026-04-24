require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Data file path
const dataDir = path.join(__dirname, "data");
const messagesFile = path.join(dataDir, "messages.json");
const filesFile = path.join(dataDir, "files.json");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Ensure messages file exists
if (!fs.existsSync(messagesFile)) {
  fs.writeFileSync(messagesFile, JSON.stringify({}));
}

// Ensure files file exists
if (!fs.existsSync(filesFile)) {
  fs.writeFileSync(filesFile, JSON.stringify({}));
}

// Helper functions
const readMessages = () => {
  try {
    return JSON.parse(fs.readFileSync(messagesFile, "utf8"));
  } catch {
    return {};
  }
};

const writeMessages = (data) => {
  fs.writeFileSync(messagesFile, JSON.stringify(data, null, 2));
};

const readFiles = () => {
  try {
    return JSON.parse(fs.readFileSync(filesFile, "utf8"));
  } catch {
    return {};
  }
};

const writeFiles = (data) => {
  fs.writeFileSync(filesFile, JSON.stringify(data, null, 2));
};

// Track active users per room
const activeUsers = {};

// In-memory room structure: roomId -> [userId1, userId2, ...]
const rooms = {};
// Track socket to user mapping: socketId -> { userId, roomId, displayName }
const socketUsers = {};

// Enable CORS for frontend
const corsOptions = {
  origin: ["http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://localhost:8083", "http://localhost:8084", "http://localhost:8085", "http://localhost:8086"],
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

// ========== MESSAGE ROUTES ==========
app.get("/api/messages/:roomId", (req, res) => {
  const { roomId } = req.params;
  const allMessages = readMessages();
  res.json(allMessages[roomId] || []);
});

app.post("/api/messages", (req, res) => {
  const { roomId, user, text, timestamp } = req.body;

  if (!roomId || !user || !text) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const allMessages = readMessages();

  if (!allMessages[roomId]) {
    allMessages[roomId] = [];
  }

  const newMessage = {
    id: Date.now(),
    user,
    text,
    timestamp: timestamp || new Date().toISOString(),
    color: "text-neon-purple",
  };

  allMessages[roomId].push(newMessage);
  writeMessages(allMessages);

  res.json(newMessage);
});

// ========== FILE ROUTES ==========
app.get("/api/files/:roomId", (req, res) => {
  const { roomId } = req.params;
  const allFiles = readFiles();

  // Initialize room with default files if it doesn't exist
  if (!allFiles[roomId]) {
    allFiles[roomId] = {
      "App.tsx": {
        content: "export default function App() {\n  return <div>Hello World</div>\n}",
        lastModified: new Date().toISOString(),
      },
      "Header.tsx": {
        content: "export function Header() {\n  return <header>Header</header>\n}",
        lastModified: new Date().toISOString(),
      },
      "main.tsx": {
        content: "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\n\nReactDOM.createRoot(document.getElementById('root')!).render(<App />)",
        lastModified: new Date().toISOString(),
      },
    };
    writeFiles(allFiles);
  }

  res.json(allFiles[roomId] || {});
});

app.post("/api/files", (req, res) => {
  const { roomId, filename, content } = req.body;

  if (!roomId || !filename || content === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const allFiles = readFiles();

  if (!allFiles[roomId]) {
    allFiles[roomId] = {};
  }

  allFiles[roomId][filename] = {
    content,
    lastModified: new Date().toISOString(),
  };

  writeFiles(allFiles);

  res.json({ filename, lastModified: allFiles[roomId][filename].lastModified });
});

// ========== USERS ROUTES ==========
app.get("/api/users/:roomId", (req, res) => {
  const { roomId } = req.params;
  res.json(activeUsers[roomId] || []);
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle join-room event
  socket.on("join-room", (data) => {
    const { roomId, userId, displayName } = data;

    // Add socket to room
    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    if (!activeUsers[roomId]) {
      activeUsers[roomId] = [];
    }

    // Add user to room (avoid duplicates for different sockets from same user)
    if (!rooms[roomId].includes(userId)) {
      rooms[roomId].push(userId);
    }

    socketUsers[socket.id] = { userId, roomId, displayName };

    // Add to active users (avoid duplicates)
    const userExists = activeUsers[roomId].find((u) => u.userId === userId);
    if (!userExists) {
      activeUsers[roomId].push({ userId, displayName });
    }

    console.log(`User ${userId} joined room ${roomId}`);

    // Broadcast to others in the room
    socket.to(roomId).emit("user-joined", { userId, displayName });
    socket.to(roomId).emit("active-users-updated", activeUsers[roomId]);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const userData = socketUsers[socket.id];

    if (userData) {
      const { userId, roomId, displayName } = userData;

      // Remove user from room
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter((id) => id !== userId);

        // Clean up empty room
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }

        // Remove from active users
        activeUsers[roomId] = activeUsers[roomId].filter((u) => u.userId !== userId);
        if (activeUsers[roomId].length === 0) {
          delete activeUsers[roomId];
        }

        // Broadcast to others in the room
        io.to(roomId).emit("user-left", { userId, displayName });
        io.to(roomId).emit("active-users-updated", activeUsers[roomId] || []);

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
