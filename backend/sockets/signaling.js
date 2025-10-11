// backend/socket/signaling.js
export default function setupSocket(io) {
  // store socketId -> { id, name, publicKey }
  const users = new Map();

  const emitPeerListToAll = () => {
    const list = Array.from(users.values()).map(u => ({
      id: u.id,
      name: u.name,
      publicKey: u.publicKey || null
    }));
    io.emit("peer-list", list);
  };

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // new-user: { name, publicKey }
    socket.on("new-user", ({ name, publicKey }) => {
      const entry = { id: socket.id, name: name || "Anonymous", publicKey: publicKey || null };
      users.set(socket.id, entry);
      console.log("new-user:", socket.id, entry.name, "hasPublicKey:", !!entry.publicKey);
      emitPeerListToAll();
    });

    // handle offer: include sender's stored publicKey when forwarding
    socket.on("offer", ({ to, offer, name, publicKey }) => {
      // update stored info for sender if provided
      const sender = users.get(socket.id) || { id: socket.id, name: name || "Anonymous", publicKey: null };
      if (publicKey) sender.publicKey = publicKey;
      sender.name = name || sender.name;
      users.set(socket.id, sender);

      console.log("offer from", socket.id, "->", to, "senderHasPublicKey:", !!sender.publicKey);
      const payload = { from: socket.id, offer, name: sender.name, publicKey: sender.publicKey || null };
      if (io.sockets.sockets.get(to)) {
        io.to(to).emit("offer", payload);
      } else {
        console.warn("offer target not found:", to);
      }
    });

    // forward answer
    socket.on("answer", ({ to, answer }) => {
      console.log("answer from", socket.id, "->", to);
      if (io.sockets.sockets.get(to)) {
        io.to(to).emit("answer", { from: socket.id, answer });
      }
    });

    // forward ice candidate
    socket.on("ice-candidate", ({ to, candidate }) => {
      if (io.sockets.sockets.get(to)) {
        io.to(to).emit("ice-candidate", { from: socket.id, candidate });
      }
    });

    // connection-accepted: notify both sides and keep names consistent
    socket.on("connection-accepted", ({ to }) => {
      const accepter = users.get(socket.id) || { id: socket.id, name: "Anonymous" };
      console.log("connection-accepted:", socket.id, "->", to);
      if (io.sockets.sockets.get(to)) {
        io.to(to).emit("connection-accepted", { from: socket.id, name: accepter.name });
      }
      // also notify accepter so UI can show the other side (if desired)
      const otherName = (users.get(to) && users.get(to).name) || "Anonymous";
      io.to(socket.id).emit("connection-accepted", { from: to, name: otherName });
    });

    // Respond to client asking for a specific peer's public key
    // payload: { to: "<peerSocketId>" }
    socket.on("get-public-key", ({ to }) => {
      const target = users.get(to);
      console.log("get-public-key request:", socket.id, "for", to, "foundKey:", !!target?.publicKey);
      // respond only to requester (socket.emit)
      socket.emit("public-key", { from: to, publicKey: target ? target.publicKey || null : null });
    });

    // allow manual refresh
    socket.on("refresh-peer-list", () => {
      emitPeerListToAll();
    });

    // handle disconnect
    socket.on("disconnect", (reason) => {
      console.log("Client disconnected:", socket.id, "reason:", reason);
      users.delete(socket.id);
      emitPeerListToAll();
    });
  });
}
