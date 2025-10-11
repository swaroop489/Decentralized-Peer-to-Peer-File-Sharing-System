import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";
import path from "path";
import fs from "fs";

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// POST /api/files/upload
router.post("/upload", verifyToken, upload.array("files"), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ message: "No files uploaded" });

  const fileNames = req.files.map(f => f.filename);
  res.status(200).json({ message: "Files uploaded successfully", files: fileNames });
});

export default router;
