import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SOCKET_SERVER_URL = "http://localhost:5000";

export default function PeerConnection() {
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const dataChannelsRef = useRef({});
  const connectedPeersRef = useRef([]);
  const sentRequestsRef = useRef(new Set());

  const [peers, setPeers] = useState([]);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [receivedFiles, setReceivedFiles] = useState([]);

  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const userName = storedUser?.name || "Anonymous";

  useEffect(() => { connectedPeersRef.current = connectedPeers; }, [connectedPeers]);

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);
    socketRef.current.emit("new-user", { name: userName });

    socketRef.current.on("peer-list", (peerList) => {
      const available = peerList
        .filter(p => p.id !== socketRef.current.id)
        .filter(p => !connectedPeersRef.current.find(cp => cp.id === p.id))
        .filter(p => !sentRequestsRef.current.has(p.id))
        .map(p => ({ ...p, status: "connect" }));
      setPeers(available);
    });

    socketRef.current.on("offer", ({ from, offer, name }) => {
      setIncomingRequest({ id: from, name, offer });
    });

    socketRef.current.on("answer", async ({ from, answer }) => {
      const pc = peerConnectionsRef.current[from];
      if (!pc) return;
      try { await pc.setRemoteDescription(answer); } catch (err) { console.error(err); }
    });

    socketRef.current.on("connection-accepted", ({ from, name }) => {
      setConnectedPeers(prev => {
        if (prev.find(p => p.id === from)) return prev;
        const next = [...prev, { id: from, name }];
        connectedPeersRef.current = next;
        return next;
      });
      setPeers(prev => prev.filter(p => p.id !== from));
      sentRequestsRef.current.delete(from);
    });

    socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc && candidate) { try { await pc.addIceCandidate(candidate); } catch (err) { console.error(err); } }
    });

    return () => {
      if (socketRef.current) { socketRef.current.off(); socketRef.current.disconnect(); }
      Object.values(peerConnectionsRef.current).forEach(pc => { try { pc.close(); } catch(e){} });
      peerConnectionsRef.current = {};
      dataChannelsRef.current = {};
    };
  }, []);

  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", { to: peerId, candidate: event.candidate });
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      dataChannelsRef.current[peerId] = channel;
      setupDataChannelHandlers(peerId, channel);
    };

    peerConnectionsRef.current[peerId] = pc;
    return pc;
  };

  const setupDataChannelHandlers = (peerId, channel) => {
    channel.binaryType = "arraybuffer";

    let receivedChunks = [];
    let receivedFileName = null;
    let receivedFileType = "application/octet-stream";
    let totalBytes = 0;

    channel.onopen = () => console.log("Data channel open", peerId);

    channel.onmessage = (e) => {
      // Handle metadata (string)
      if (typeof e.data === "string") {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "meta") {
            receivedFileName = msg.fileName || "unknown";
            receivedFileType = msg.fileType || "application/octet-stream";
            totalBytes = msg.fileSize || 0;
            receivedChunks = [];
            setProgressMap(prev => ({ ...prev, [peerId]: 0 }));
            console.log("Meta received for:", receivedFileName);
          } if (msg.type === "done") {
  if (receivedChunks.length > 0) {
    const fileName = receivedFileName || "unknown.txt";  
    const fileType = receivedFileType || "application/octet-stream";
    const blob = new Blob(receivedChunks, { type: fileType });
    const url = URL.createObjectURL(blob);

    const sender = connectedPeersRef.current.find(p => p.id === peerId) || { id: peerId, name: "Unknown" };
    setReceivedFiles(prev => [{ name: fileName, url, from: { id: sender.id, name: sender.name } }, ...prev]);
    setProgressMap(prev => ({ ...prev, [peerId]: 0 }));
    console.log("Auto-completed file:", fileName);
  }
  receivedChunks = [];
  receivedFileName = null;
  receivedFileType = "application/octet-stream";
}}  
catch (err) { console.error("Invalid JSON control message", err); }
      } else {
        // Handle binary chunk
        receivedChunks.push(e.data);
        if (totalBytes) {
          const percent = Math.floor((receivedChunks.reduce((acc, b) => acc + b.byteLength, 0) / totalBytes) * 100);
          setProgressMap(prev => ({ ...prev, [peerId]: percent }));
        }
      }
    };

    channel.onclose = () => console.log("Data channel closed", peerId);
    channel.onerror = (err) => console.error("Data channel error", err);
  };

  const connectToPeer = async (peer) => {
    sentRequestsRef.current.add(peer.id);
    setPeers(prev => prev.map(p => p.id === peer.id ? { ...p, status: "sent" } : p));

    const pc = createPeerConnection(peer.id);

    const dc = pc.createDataChannel("fileTransport");
    dataChannelsRef.current[peer.id] = dc;
    setupDataChannelHandlers(peer.id, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit("offer", { to: peer.id, offer, name: userName });
  };

  const acceptConnection = async () => {
    if (!incomingRequest) return;
    const { id, offer, name } = incomingRequest;

    const pc = createPeerConnection(id);
    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit("answer", { to: id, answer });
      socketRef.current.emit("connection-accepted", { to: id });

      setConnectedPeers(prev => {
        if (prev.find(p => p.id === id)) return prev;
        const next = [...prev, { id, name }];
        connectedPeersRef.current = next;
        return next;
      });
      setPeers(prev => prev.filter(p => p.id !== id));
    } catch (err) { console.error(err); }
    setIncomingRequest(null);
  };

  const declineConnection = () => setIncomingRequest(null);

  const handleFileChangeForPeer = (peerId, e) => {
    const file = e.target.files[0];
    setSelectedFiles(prev => ({ ...prev, [peerId]: file }));
  };

  const sendFileToPeer = (peerId) => {
    const file = selectedFiles[peerId];
    if (!file) return alert("Select a file first for this peer.");

    const channel = dataChannelsRef.current[peerId];
    if (!channel || channel.readyState !== "open") return alert("Data channel not open yet.");

    const chunkSize = 16 * 1024;
    const fileReader = new FileReader();
    let offset = 0;

    channel.send(JSON.stringify({
      type: "meta",
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size
    }));

    fileReader.onerror = (err) => console.error(err);

    const readSlice = (o) => {
      const slice = file.slice(o, o + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = (e) => {
      try { channel.send(e.target.result); } catch(err) { console.error(err); }
      offset += e.target.result.byteLength;
      setProgressMap(prev => ({ ...prev, [peerId]: Math.floor((offset / file.size) * 100) }));
      if (offset < file.size) readSlice(offset);
      else {
        setTimeout(() => { try { channel.send(JSON.stringify({ type: "done" })); } catch(e){} }, 20);
        setTimeout(() => setProgressMap(prev => ({ ...prev, [peerId]: 0 })), 1200);
      }
    };

    readSlice(0);
  };

  const disconnectPeer = (peerId) => {
    peerConnectionsRef.current[peerId]?.close();
    delete peerConnectionsRef.current[peerId];
    delete dataChannelsRef.current[peerId];

    setConnectedPeers(prev => {
      const next = prev.filter(p => p.id !== peerId);
      connectedPeersRef.current = next;
      return next;
    });

    if (socketRef.current) socketRef.current.emit("refresh-peer-list");
  };

  const downloadReceived = (file) => {
  if (!file || !file.url) return;
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.name || "download.txt"; 
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12">
      {/* Incoming Connection Modal */}
      {incomingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full text-center">
            <h3 className="text-lg font-bold mb-4">Incoming Connection</h3>
            <p className="mb-4">{incomingRequest.name} wants to connect</p>
            <div className="flex justify-center gap-4">
              <button onClick={acceptConnection} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Accept</button>
              <button onClick={declineConnection} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* Top: Available Peers */}
      <div className="border shadow-sm p-5 rounded-md hover:shadow-lg">
        <h3 className="text-2xl font-semibold mb-4 text-gray-700">Available Peers</h3>
        {peers.length === 0 ? (
          <p className="text-gray-500">No peers available</p>
        ) : (
          <div className="flex flex-col gap-4">
            {peers.map(peer => (
              <div key={peer.id} className="w-full p-5 border rounded shadow  flex flex-col md:flex-row md:justify-between items-center gap-4">
                <div>
                  <div className="font-medium text-gray-800 text-lg">{peer.name}</div>
                  <div className="text-sm text-gray-500">{peer.id}</div>
                </div>
                <button 
                  disabled={peer.status !== "connect"} 
                  onClick={() => connectToPeer(peer)}
                  className={`px-4 py-2 rounded text-white ${peer.status === "connect" ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"}`}
                >
                  {peer.status === "connect" ? "Connect" : peer.status === "sent" ? "Request Sent" : "Accepted"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Middle: Connected Peers */}
      <div className="border shadow-sm p-5 rounded-md hover:shadow-lg">
        <h3 className="text-2xl font-semibold mb-4 text-gray-700">Connected Peers</h3>
        {connectedPeers.length === 0 ? (
          <p className="text-gray-500">No peers connected yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {connectedPeers.map(({ id, name }) => (
              <div key={id} className="w-full p-5 border rounded shadow bg-green-50 flex flex-col md:flex-row md:justify-between items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium text-gray-800 text-lg">{name} <span className="text-sm text-gray-500">({id})</span></div>
                </div>
                <input type="file" onChange={(e) => handleFileChangeForPeer(id, e)} className="border rounded px-3 py-2 w-full md:w-60" />
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                  <button onClick={() => sendFileToPeer(id)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full md:w-auto">Send File</button>
                  <button onClick={() => disconnectPeer(id)} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full md:w-auto">Disconnect</button>
                </div>
                {progressMap[id] > 0 && (
                  <div className="w-full mt-2 bg-gray-200 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${progressMap[id]}%`, backgroundColor: "#16a34a" }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Received Files */}
      <div className="border shadow-sm p-5 rounded-md hover:shadow-lg">
        <h3 className="text-2xl font-semibold mb-4 text-gray-700">Received Files</h3>
        {receivedFiles.length === 0 ? (
          <p className="text-gray-500">No files received yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {receivedFiles.map((f, i) => (
              <div key={i} className="w-full p-5 border rounded shadow flex flex-col md:flex-row md:justify-between items-center gap-4">
                <div>
                  <div className="font-medium text-gray-800">{f.name}</div>
                  <div className="text-sm text-gray-500">From: {f.from.name} ({f.from.id})</div>
                </div>
                <button onClick={() => downloadReceived(f)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Download</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}