import React, { useState } from "react";
import Navbar from "../components/Navbar";


export default function Home() {
  // State
  const [files, setFiles] = useState([]);
  const [peers, setPeers] = useState([]);

  // Drag & Drop handlers
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (e) => e.preventDefault();

  // File input change
  const handleFileChange = (e) => setFiles([...files, ...Array.from(e.target.files)]);

  // Upload action
  const handleUpload = () => {
    if (files.length === 0) return alert("No files selected");
    console.log("Uploading files:", files);
    // TODO: integrate with backend / socket.io
  };

  // Peer actions
  const handleConnectPeer = () => console.log("Connect peer clicked");
  const handleConnect = (peerId) => console.log("Connect to peer:", peerId);
  const handleDisconnect = (peerId) => console.log("Disconnect from peer:", peerId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="text-center my-12 px-4">
        <h2 className="text-4xl font-extrabold mb-3">Secure Peer-to-Peer File Sharing</h2>
        <p className="text-gray-600 mb-6">
          Fast, decentralized, and easy to use. Share files directly with connected peers.
        </p>
        <div className="space-x-4">
          <button
            onClick={handleUpload}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Upload File
          </button>
          <button
            onClick={handleConnectPeer}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
          >
            Connect Peer
          </button>
        </div>
      </section>

      {/* File Upload Section */}
      <section
        className="max-w-2xl mx-auto my-10 p-6 bg-white rounded shadow-md border-dashed border-2 border-gray-300 hover:border-blue-400 transition cursor-pointer text-center"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById("fileInput").click()}
      >
        <input
          id="fileInput"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-gray-500">Drag & drop files here, or click to select files</p>
        {files.length > 0 && (
          <div className="mt-4 text-left">
            <h4 className="font-semibold mb-2">Selected Files:</h4>
            <ul className="list-disc ml-5">
              {files.map((file, idx) => (
                <li key={idx}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Connected Peers Section */}
      <section className="max-w-2xl mx-auto my-10 p-6 bg-white rounded shadow-md">
        <h3 className="text-xl font-bold mb-4">Connected Peers</h3>
        {peers.length === 0 ? (
          <p className="text-gray-500">No peers connected yet.</p>
        ) : (
          <ul>
            {peers.map((peer) => (
              <li
                key={peer.id}
                className="flex justify-between items-center mb-2 p-2 border rounded hover:bg-gray-100 transition"
              >
                <span>{peer.name || peer.id}</span>
                <div className="space-x-2">
                  <button
                    onClick={() => handleConnect(peer.id)}
                    className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition"
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => handleDisconnect(peer.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition"
                  >
                    Disconnect
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center p-6 text-gray-500 text-sm bottom-0">
        © 2025 P2P FileShare. All rights reserved.
      </footer>
    </div>
    
  );
}
