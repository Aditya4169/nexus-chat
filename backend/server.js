require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const { initializeSocket } = require('./socket/socket');

const app = express();
const httpServer = http.createServer(app);
const port = Number(process.env.PORT) || 5000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: frontendUrl }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

const io = new Server(httpServer, {
  cors: { origin: frontendUrl, methods: ['GET', 'POST'] }
});

// Initialize Socket.IO handlers (auth, connection, events, etc.)
initializeSocket(io);

// Simple fallback connection handler (optional logging)
io.on('connection', (socket) => {
  // All socket logic is handled by initializeSocket
});

const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use.`);
  else console.error('Server error:', error.message);
  process.exit(1);
});

startServer();

module.exports = { app, io, httpServer };
