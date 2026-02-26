import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

// Route Imports
import userRoutes from './routes/userRoutes.js';
import dustbinRoutes from './routes/dustbinRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import workerRoutes from './routes/workerRoutes.js';
import wasteRoutes from './routes/wasteRoutes.js';

const app = express();
const server = http.createServer(app);

// Socket.io Setup
// const io = new Server(server, {
//   cors: {
//     origin: "*", 
//     methods: ["GET", "POST"],
//     credentials: true
//   },
// });

// app.set("io", io);

// io.on("connection", (socket) => {
//   console.log("User Connected:", socket.id);

//   socket.on("join_room", (roomId) => {
//     socket.join(roomId);
//     console.log(`User ${socket.id} joined room: ${roomId}`);
//   });

//   socket.on("typing", (room) => {
//     socket.in(room).emit("typing");
//   });

//   socket.on("stop_typing", (room) => {
//     socket.in(room).emit("stop_typing");
//   });

//   socket.on("disconnect", () => {
//     console.log("User Disconnected", socket.id);
//   });
// });

// Middleware (Important: Routes se pehle rakhein)
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: "20kb" })); 
app.use(express.urlencoded({ extended: true, limit: "20kb" }));

// API Endpoints
app.use('/api/users', userRoutes);
app.use('/api/dustbins', dustbinRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api', wasteRoutes);

app.get('/ping', (req, res) => {
  res.status(200).send("Server is awake!");
});

export { app, server };