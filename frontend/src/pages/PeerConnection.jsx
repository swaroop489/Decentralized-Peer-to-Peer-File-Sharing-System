import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  generateRSAKeyPair,
  exportPublicKey,
  importPublicKey,
  generateAESKey,
  encryptAESKeyWithRSA,
  decryptAESKeyWithRSA,
  encryptChunkAES,
  decryptChunkAES,
} from "../utils/cryptoUtils";
import { useToast } from "../context/ToastContext";

const SOCKET_SERVER_URL = "http://localhost:5000";

export default function PeerConnection() {
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const dataChannelsRef = useRef({});
  const connectedPeersRef = useRef([]);
  const sentRequestsRef = useRef(new Set());
  const aesKeysRef = useRef({}); // { peerId: CryptoKey }
  const peerPublicKeysRef = useRef({}); // runtime ref
  const transferAckResolversRef = useRef({}); // { "peerId_transferId": resolve }

  const [peers, setPeers] = useState([]);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [myPublicKey, setMyPublicKey] = useState(null);
  const [myPrivateKey, setMyPrivateKey] = useState(null);
  const [peerPublicKeys, setPeerPublicKeys] = useState({}); // mirror for render/debug

  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const userName = storedUser?.name || "Anonymous";

  const { addToast } = useToast();

  useEffect(() => {
    connectedPeersRef.current = connectedPeers;
  }, [connectedPeers]);

  // Generate RSA keys on mount
  useEffect(() => {
    (async () => {
      const { publicKey, privateKey } = await generateRSAKeyPair();
      setMyPrivateKey(privateKey);
      const exported = await exportPublicKey(publicKey);
      setMyPublicKey(exported);
    })();
  }, []);

    

  // Initialize socket only after myPublicKey is ready
  useEffect(() => {
    if (!myPublicKey) return;

    socketRef.current = io(SOCKET_SERVER_URL);

    socketRef.current.on("connect", () => {
      console.log("socket connected:", socketRef.current.id);
      // Announce new user with public key
      socketRef.current.emit("new-user", { name: userName, publicKey: myPublicKey });
    });

    socketRef.current.on("connection-declined", ({ from, name }) => {
  console.debug("connection-declined from", from);

  // Show toast for sender
  addToast(`${name} rejected your connection request`, "error");

  // Remove from sentRequestsRef
  sentRequestsRef.current.delete(from);

  // Temporarily highlight rejected peer in UI
  setPeers(prev => prev.map(p =>
    p.id === from ? { ...p, rejected: true } : p
  ));
  setTimeout(() => {
    setPeers(prev => prev.map(p =>
      p.id === from ? { ...p, rejected: false } : p
    ));
  }, 3000);
});

    // Debug: raw peer-list
    socketRef.current.on("peer-list", (peerList) => {
      console.debug("socket peer-list received:", peerList);
      const selfId = socketRef.current?.id;
      const available = peerList
        .filter(p => p.id !== selfId)
        .filter(p => !connectedPeersRef.current.find(cp => cp.id === p.id))
        .filter(p => !sentRequestsRef.current.has(p.id))
        .map(p => ({ ...p, status: "connect" }));

      // import and set keys into ref & state
      peerList.forEach(async (p) => {
        if (p.publicKey && !peerPublicKeysRef.current[p.id]) {
          try {
            const imported = await importPublicKey(p.publicKey);
            peerPublicKeysRef.current[p.id] = imported;
            setPeerPublicKeys(prev => ({ ...prev, [p.id]: imported }));
            console.debug("Imported publicKey from peer-list for", p.id);
          } catch (err) {
            console.error("Import public key (peer-list) failed for", p.id, err);
          }
        }
      });
      setPeers(available);
    });

    // Incoming offer (also may contain publicKey of offerer)
    socketRef.current.on("offer", ({ from, offer, name, publicKey }) => {
      console.debug("offer received from", from, { name, hasPublicKey: !!publicKey });
      if (publicKey && !peerPublicKeysRef.current[from]) {
        importPublicKey(publicKey)
          .then(imported => {
            peerPublicKeysRef.current[from] = imported;
            setPeerPublicKeys(prev => ({ ...prev, [from]: imported }));
            console.debug("Imported publicKey from offer for", from);
          })
          .catch(err => console.error("Import public key (offer) failed", err));
      }
      setIncomingRequest({ id: from, name, offer });
    });

    // Incoming answer
    socketRef.current.on("answer", async ({ from, answer }) => {
      console.debug("answer received from", from);
      const pc = peerConnectionsRef.current[from];
      if (!pc) return console.warn("No RTCPeerConnection for", from);
      try {
        await pc.setRemoteDescription(answer);
      } catch (err) {
        console.error("setRemoteDescription(answer) failed", err);
      }
    });

    // Connection accepted
    socketRef.current.on("connection-accepted", ({ from, name }) => {
      console.debug("connection-accepted from", from);
      addToast(`${name} accepted your connection request`, "success");
      setConnectedPeers(prev => {
        if (prev.find(p => p.id === from)) return prev;
        const next = [...prev, { id: from, name }];
        connectedPeersRef.current = next;
        return next;
      });
      setPeers(prev => prev.filter(p => p.id !== from));
      sentRequestsRef.current.delete(from);
    });

    // ICE candidate
    socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc && candidate) {
        try { await pc.addIceCandidate(candidate); } catch (err) { console.error("addIceCandidate failed", err); }
      }
    });

    // Server will reply with this when someone requested a public key (or when peer-list sends)
    socketRef.current.on("public-key", ({ from, publicKey }) => {
      console.debug("public-key event received for", from, "hasPublicKey:", !!publicKey);
      if (!publicKey) return;
      (async () => {
        try {
          const imported = await importPublicKey(publicKey);
          peerPublicKeysRef.current[from] = imported;
          setPeerPublicKeys(prev => ({ ...prev, [from]: imported }));
          console.debug("Imported publicKey from public-key event for", from);
        } catch (err) {
          console.error("Failed to import public key (public-key event)", err);
        }
      })();
    });
    socketRef.current.on("peer-disconnected", ({ id, name }) => {
  addToast(`${name} disconnected`, "warning");

  // Remove from connected peers
  setConnectedPeers(prev => {
    const next = prev.filter(p => p.id !== id);
    connectedPeersRef.current = next;
    return next;
  });
});


    // fallback debug
    socketRef.current.on("disconnect", (reason) => {
      console.warn("socket disconnected:", reason);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
      }
      Object.values(peerConnectionsRef.current).forEach(pc => { try { pc.close(); } catch(e){} });
      peerConnectionsRef.current = {};
      dataChannelsRef.current = {};
    };
  }, [myPublicKey]); // only depend on myPublicKey

  // PeerConnection + DataChannel setup
  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection();

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
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

    // per-channel current transfer state (works if only one active transfer at a time per peer)
    let receivedChunks = [];
    let receivedFileName = null;
    let receivedFileType = "application/octet-stream";
    let totalBytes = 0;
    let currentAESKey = null;

    channel.onopen = () => console.log("Data channel open", peerId);

    channel.onmessage = async (e) => {
      if (typeof e.data === "string") {
        try {
          const msg = JSON.parse(e.data);

          if (msg.type === "init") {
            // init: contains encrypted AES key + meta + transferId
            const encryptedAES = Uint8Array.from(atob(msg.encryptedKey), c => c.charCodeAt(0)).buffer;
            try {
              currentAESKey = await decryptAESKeyWithRSA(encryptedAES, myPrivateKey);
              aesKeysRef.current[peerId] = currentAESKey;
              console.debug("AES key decrypted for", peerId, "via init");
            } catch (err) {
              console.error("decryptAESKeyWithRSA (init) failed", err);
              // can't process this transfer
              return;
            }

            // set metadata for incoming file
            receivedFileName = msg.fileName || null;
            receivedFileType = msg.fileType || "application/octet-stream";
            totalBytes = msg.fileSize || 0;
            receivedChunks = [];
            setProgressMap(prev => ({ ...prev, [peerId]: 0 }));

            // send back init-ack with transferId so sender can start sending chunks
            try {
              channel.send(JSON.stringify({ type: "init-ack", transferId: msg.transferId }));
            } catch (err) {
              console.error("failed to send init-ack", err);
            }

            return;
          }

          if (msg.type === "init-ack") {
            // resolve waiting sender promise if present
            const key = `${peerId}_${msg.transferId}`;
            const resolver = transferAckResolversRef.current[key];
            if (resolver) {
              resolver(true);
              delete transferAckResolversRef.current[key];
            }
            return;
          }

          if (msg.type === "done") {
            if (receivedChunks.length > 0) {
              const blob = new Blob(receivedChunks, { type: receivedFileType || "application/octet-stream" });
              const url = URL.createObjectURL(blob);
              const sender = connectedPeersRef.current.find(p => p.id === peerId) || { id: peerId, name: "Unknown" };
              // determine filename (keep original if present)
              const nameToUse = receivedFileName || (`file_${Date.now()}` + (receivedFileType && receivedFileType.split("/")[1] ? `.${receivedFileType.split("/")[1]}` : ".bin"));

              setReceivedFiles(prev => [{ name: nameToUse, url, fileType: receivedFileType, from: { id: sender.id, name: sender.name } }, ...prev]);
              setProgressMap(prev => ({ ...prev, [peerId]: 0 }));
              addToast(`Received file ${nameToUse} from ${sender.name}`, "info");
            }

            // reset transfer state
            receivedChunks = [];
            receivedFileName = null;
            receivedFileType = "application/octet-stream";
            totalBytes = 0;
            currentAESKey = null;
            return;
          }

        } catch (err) { console.error("Invalid JSON control message", err); }
      } else {
        // binary chunk
        if (!currentAESKey) {
          console.error("AES key not set for peer", peerId);
          return;
        }
        const buffer = e.data;
        const iv = buffer.slice(0, 12);
        const encryptedChunk = buffer.slice(12);
        try {
          const decrypted = await decryptChunkAES(currentAESKey, encryptedChunk, iv);
          receivedChunks.push(decrypted);

        } catch (err) {
          console.error("decryptChunkAES failed", err);
          return;
        }

        if (totalBytes) {
          const percent = Math.floor((receivedChunks.reduce((acc, b) => acc + b.byteLength, 0) / totalBytes) * 100);
          setProgressMap(prev => ({ ...prev, [peerId]: percent }));
        }
      }
    };

    channel.onclose = () => console.log("Data channel closed", peerId);
    channel.onerror = (err) => console.error("Data channel error", err);
  };

  // helper: ask server for peer public key and wait a bit (retries)
  const requestPeerPublicKeyAndWait = async (peerId, attempts = 6, delayMs = 400) => {
    for (let i = 0; i < attempts; i++) {
      if (peerPublicKeysRef.current[peerId]) return peerPublicKeysRef.current[peerId];
      // ask server to send it (server should forward the key if it has it)
      if (socketRef.current && socketRef.current.connected) {
        console.debug(`requesting public key for ${peerId}, attempt ${i + 1}`);
        socketRef.current.emit("get-public-key", { to: peerId });
      }
      // small wait
      await new Promise(res => setTimeout(res, delayMs));
      if (peerPublicKeysRef.current[peerId]) return peerPublicKeysRef.current[peerId];
    }
    return null;
  };

  // Connect to peer (send offer)
  const connectToPeer = async (peer) => {
    if (!myPublicKey) return alert("Your public key not ready yet");
    sentRequestsRef.current.add(peer.id);
    setPeers(prev => prev.map(p => p.id === peer.id ? { ...p, status: "sent" } : p));

    const pc = createPeerConnection(peer.id);
    const dc = pc.createDataChannel("fileTransport");
    dataChannelsRef.current[peer.id] = dc;
    setupDataChannelHandlers(peer.id, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // include myPublicKey in the offer so remote can import
    socketRef.current.emit("offer", { to: peer.id, offer, name: userName, publicKey: myPublicKey });
  };

  // Accept / decline connection
  const acceptConnection = async () => {
    if (!incomingRequest) return;
    const { id, offer, name } = incomingRequest;

    const pc = createPeerConnection(id);
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
    addToast(`Connection accepted with ${name}`, "success");
    setPeers(prev => prev.filter(p => p.id !== id));
    setIncomingRequest(null);
  };

  const declineConnection = () => {
  if (!incomingRequest) return;

  const { id, name } = incomingRequest; // id = peer who sent request

  // Show toast locally
  addToast("Connection request declined", "error");

  // Emit to backend so sender knows
  if (socketRef.current && socketRef.current.connected) {
    socketRef.current.emit("connection-declined", { to: id });
  }

  setIncomingRequest(null);
};

  // File handling
  const handleFileChangeForPeer = (peerId, e) => {
    const file = e.target.files[0];
    setSelectedFiles(prev => ({ ...prev, [peerId]: file }));
  };

  const waitForInitAck = (peerId, transferId, timeoutMs = 5000) => {
    return new Promise((resolve) => {
      const key = `${peerId}_${transferId}`;
      transferAckResolversRef.current[key] = (val) => resolve(!!val);
      // timeout fallback
      setTimeout(() => {
        if (transferAckResolversRef.current[key]) {
          delete transferAckResolversRef.current[key];
          resolve(false);
        }
      }, timeoutMs);
    });
  };

  const sendFileToPeer = async (peerId) => {
    const file = selectedFiles[peerId];
    if (!file) return alert("Select a file first for this peer.");

    const channel = dataChannelsRef.current[peerId];
    if (!channel || channel.readyState !== "open") return alert("Data channel not open yet.");

    // Fast-path: if we already have the key in the ref, use it
    let peerPublicKey = peerPublicKeysRef.current[peerId];

    // If missing, try requesting and waiting a few times
    if (!peerPublicKey) {
      console.debug("peer public key missing, attempting get-public-key flow for", peerId);
      peerPublicKey = await requestPeerPublicKeyAndWait(peerId, 6, 400);
    }

    console.debug("sendFileToPeer:", { peerId, hasPeerPublicKey: !!peerPublicKey, peerPublicKeysRefKeys: Object.keys(peerPublicKeysRef.current) });

    if (!peerPublicKey) {
      console.error("Peer public key still not available for", peerId);
      return alert("Peer public key not available yet. Please ensure the remote client/server is forwarding public keys.");
    }

    // AES key encryption
    const aesKey = await generateAESKey();
    aesKeysRef.current[peerId] = aesKey;
    const encryptedAES = await encryptAESKeyWithRSA(aesKey, peerPublicKey);
    const b64AES = btoa(String.fromCharCode(...new Uint8Array(encryptedAES)));

    // Create a transferId for this transfer (to match init/ack)
    const transferId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Send a single init control message containing encrypted AES key + metadata + transferId
    try {
      channel.send(JSON.stringify({
        type: "init",
        encryptedKey: b64AES,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        transferId,
      }));
    } catch (err) {
      console.error("failed to send init", err);
      return alert("Failed to initialize file transfer.");
    }

    // wait for init-ack (or timeout)
    const ack = await waitForInitAck(peerId, transferId, 5000);
    if (!ack) {
      console.warn("init-ack not received, continuing anyway (may fail)");
      // we still continue — small network delays could be the cause. You can choose to abort here if desired.
    }

    const chunkSize = 16 * 1024;
    const fileReader = new FileReader();
    let offset = 0;

    const readSlice = async (o) => {
      const slice = file.slice(o, o + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = async (e) => {
      try {
        const { encrypted, iv } = await encryptChunkAES(aesKeysRef.current[peerId], e.target.result);
        // encrypted is ArrayBuffer; iv is Uint8Array
        const encryptedArr = new Uint8Array(encrypted);
        const combined = new Uint8Array(iv.byteLength + encryptedArr.byteLength);
        combined.set(iv, 0);
        combined.set(encryptedArr, iv.byteLength);
        channel.send(combined);
      } catch (err) {
        console.error("encrypt/send chunk failed", err);
        return alert("Failed to encrypt/send chunk.");
      }

      offset += e.target.result.byteLength;
      setProgressMap(prev => ({ ...prev, [peerId]: Math.floor((offset / file.size) * 100) }));
      if (offset < file.size) readSlice(offset);
      else {
  setTimeout(() => { 
    try { 
      channel.send(JSON.stringify({ type: "done", transferId }));
      const peer = connectedPeers.find(p => p.id === peerId);
      const peerName = peer ? peer.name : peerId;  
      addToast(`File ${file.name} sent successfully to ${peerName}`, "success");
    } catch(e){} 
  }, 20);
  setTimeout(() => setProgressMap(prev => ({ ...prev, [peerId]: 0 })), 1200);
}

    };

    readSlice(0);
  };

  const disconnectPeer = (peerId) => {
  //  Close peer connection + cleanup local state
  peerConnectionsRef.current[peerId]?.close();
  delete peerConnectionsRef.current[peerId];
  delete dataChannelsRef.current[peerId];
  delete aesKeysRef.current[peerId];
  delete peerPublicKeysRef.current[peerId];

  setPeerPublicKeys(prev => {
    const next = { ...prev };
    delete next[peerId];
    return next;
  });

  setConnectedPeers(prev => {
    const next = prev.filter(p => p.id !== peerId);
    connectedPeersRef.current = next;
    return next;
  });

  //  Notify the other peer via backend
  if (socketRef.current && socketRef.current.connected) {
    socketRef.current.emit("manual-disconnect", { to: peerId });
  }

  // Local toast for feedback
  addToast("You disconnected from peer", "warning");

  // Optional: refresh peer list after short delay
  setTimeout(() => {
    if (socketRef.current) socketRef.current.emit("refresh-peer-list");
  }, 500);
};


  const downloadReceived = (file) => {
    if (!file || !file.url) return;
    const a = document.createElement("a");
    a.href = file.url;

    let suggested = file.name;
    if (!suggested) {
      const ext = file.fileType ? `.${file.fileType.split("/")[1] || "bin"}` : ".bin";
      suggested = `file_${Date.now()}${ext}`;
    }
    a.download = suggested;
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
              <div key={peer.id} className="w-full p-5 border rounded shadow flex flex-col md:flex-row md:justify-between items-center gap-4">
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
