# Decentralized Peer-to-Peer File Sharing System

![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2025-orange)  

A **secure, fast, and decentralized file sharing platform** that allows users to share files directly with peers without relying on a central server. Built with **MERN stack** and JWT-based authentication.

---

## 🧠 Overview

This project is a full-stack decentralized peer-to-peer (P2P) file sharing application.  
Unlike traditional file sharing systems (like Google Drive), files are shared **directly between users**, improving privacy, fault tolerance, and reducing dependency on central servers.

**Key Features:**  
- User registration and login with **JWT authentication**  
- Secure file upload and download  
- Peer discovery and connection  
- Real-time updates of connected peers  
- Decentralized file sharing simulation using Socket.io  

---

## ⚙️ Tech Stack


**Frontend:**  
- React  
- Tailwind CSS  
- React Router  

**Backend:**  
- Node.js, Express.js  
- MongoDB & Mongoose  
- JWT for authentication  
- bcrypt for password hashing  
- Socket.io for peer communication  

**Communication:**  
- REST API for authentication and file upload  
- WebSocket (Socket.io) for real-time P2P connections  

---

## 🏗️ Project Structure

```bash


Decentralized-Peer-to-Peer-File-Sharing-System/
│
├── frontend/ # React frontend
│ ├── src/
│ │ ├── pages/ # Login, Signup, Home
│ │ ├── components/ # Navbar, FileUpload, PeersList, Hero
│
├── backend/ # Express backend
│ ├── models/ # User model
│ ├── routes/ # Auth and Files routes
│ ├── middleware/ # JWT verification middleware
│ ├── uploads/ # Temporary file storage
│ └── server.js # Entry point
│
├── .env.example # Environment variables template
└── README.md

```

---


## 🛠️ Installation

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET
npm start

```
### Frontend
```bash
cd frontend
npm install
npm run dev

```

Backend runs on http://localhost:5000 
Frontend runs on http://localhost:5173 


---

## 🔐 Authentication Flow

- User signs up via /api/auth/register → password hashed with bcrypt
- User logs in via /api/auth/login → JWT token generated and sent to frontend
- Frontend stores:
    - localStorage.setItem("token", data.token);
    - localStorage.setItem("user", JSON.stringify(data.user));

- JWT is sent in Authorization: Bearer <token> for protected routes

---

## 💡 Future Improvements

- Real fully decentralized file transfer using WebRTC

- File encryption for extra security

- Peer-to-peer file sharing without backend relay

- History of uploaded/downloaded files per user

---

## 📌 Contribution Guidelines

- This project is Hacktoberfest 2025 friendly

- Add the hacktoberfest label to issues you want to work on

- PRs should be self-contained, well-tested, and documented

- Feel free to improve UI, add features, or fix bugs


---




















