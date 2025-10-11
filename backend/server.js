import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import http from "http";
import { Server } from "socket.io";
import setupSocket from "./sockets/signaling.js";


dotenv.config();
const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});



// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);

// DB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error", err));


setupSocket(io);


// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
