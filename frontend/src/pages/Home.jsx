import React, { useState } from "react";
import Navbar from "../components/Navbar";
import PeerConnection from "./PeerConnection";
import { ToastProvider } from "../context/ToastContext";

export default function Home() {
  const [peers, setPeers] = useState([]);

  const handleConnectPeer = () => console.log("Connect peer clicked");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gray-50 py-10 px-6 text-center  mt-1 shadow-sm">
        <h1 className="text-5xl font-extrabold mb-4">Decentralized P2P File Sharing</h1>
        <p className="text-lg max-w-xl mx-auto mb-6">
          Transfer files securely and directly between peers. No central storage, fully decentralized.
        </p>
        <button
          onClick={handleConnectPeer}
          className="bg-white text-blue-600 font-semibold px-8 py-3 rounded-full shadow-md hover:shadow-lg hover:bg-gray-100 transition"
        >
          Connect Peer
        </button>
      </section>

      {/* Peer-to-Peer File Transfer */}
      <ToastProvider>
      <PeerConnection />
    </ToastProvider>

      {/* Footer */}
      <footer className="text-center p-6 text-gray-500 text-sm mt-12 border-t">
        © 2025 P2P FileShare. All rights reserved.
      </footer>
    </div>
  );
}
