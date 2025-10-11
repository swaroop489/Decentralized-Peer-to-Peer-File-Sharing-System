// backend/socket/signaling.js
export default function setupSocket(io) {
  let connectedPeers = [];

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Store user name when client connects
    socket.on("new-user", ({ name }) => {
      socket.userName = name || "Anonymous";
      connectedPeers.push({ id: socket.id, name: socket.userName });
      io.emit("peer-list", connectedPeers);
    });

    // Handle offer
    socket.on("offer", ({ to, offer, name }) => {
      io.to(to).emit("offer", { from: socket.id, offer, name });
    });

    // Handle answer
    socket.on("answer", ({ to, answer }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    // Handle ICE candidates
    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    // Handle connection acceptance
    socket.on("connection-accepted", ({ to }) => {
      const accepterName = socket.userName;
      // Notify original requester
      io.to(to).emit("connection-accepted", { from: socket.id, name: accepterName });
      // Notify accepter too so UI updates for them
      io.to(socket.id).emit("connection-accepted", { from: to, name: getPeerName(to) });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      connectedPeers = connectedPeers.filter((p) => p.id !== socket.id);
      io.emit("peer-list", connectedPeers);
    });

    const getPeerName = (id) => {
      const peer = connectedPeers.find((p) => p.id === id);
      return peer ? peer.name : "Anonymous";
    };
  });
}
