import React, { useState } from "react";

export default function FileUpload() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");

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
  const handleUpload = async () => {
    if (files.length === 0) return alert("No files selected");
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Uploaded: ${data.files.join(", ")}`);
        setFiles([]);
      } else setStatus(`Error: ${data.message}`);
    } catch (err) {
      setStatus("Upload failed. Try again.");
    }
  };

  return (
    <>
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
    <div className="text-center mt-4">
  <button
    onClick={handleUpload}
    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
  >
    Upload
  </button>
  {status && <p className="mt-2">{status}</p>}
</div>

</>
  );
}
