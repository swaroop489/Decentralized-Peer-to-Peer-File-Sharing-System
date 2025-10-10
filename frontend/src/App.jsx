import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
// import Files from "./pages/Files";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* <Route path="/files" element={<Files />} /> */}
        <Route path="/login" element={<Login />} />
         <Route path="/signup" element={<Signup />} /> 
      </Routes>
    </Router>
  );
}

export default App;
