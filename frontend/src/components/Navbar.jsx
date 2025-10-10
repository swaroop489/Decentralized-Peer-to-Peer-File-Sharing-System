import React from "react";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center p-4 z-50 shadow-md">
      <h1 className="text-xl font-bold">Decentralized Peer-to-Peer FileSharing System</h1>
      <div>
        <button className="bg-white text-blue-600 px-4 py-1 rounded hover:bg-gray-200">
          Login
        </button>
      </div>
    </nav>
  );
}
