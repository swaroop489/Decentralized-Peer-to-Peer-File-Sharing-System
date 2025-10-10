import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser.name) {
      setUser(storedUser.name); 
    } else {
      setUser(null);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  return (
    <nav className="flex justify-between items-center p-4 z-50 shadow-md bg-white">
      <h1
        className="text-xl font-bold cursor-pointer"
        onClick={() => navigate("/")}
      >
        Decentralized Peer-to-Peer FileSharing System
      </h1>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-gray-700 font-medium">
              Hi, {user} {/* shows actual name */}
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate("/login")}
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="bg-white text-blue-600 border border-blue-600 px-4 py-1 rounded hover:bg-blue-50"
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
