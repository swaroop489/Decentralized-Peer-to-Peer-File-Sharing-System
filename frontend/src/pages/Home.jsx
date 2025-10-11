import React, { useState } from "react";
import Navbar from "../components/Navbar";
import FileUpload from "./FileUpload";

export default function Home() {
  const [peers, setPeers] = useState([]);

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
            onClick={handleConnectPeer}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
          >
            Connect Peer
          </button>
        </div>
      </section>

      {/* File Upload Component */}
      <FileUpload />

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
