import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";  
import Home from "./Home";            
import Dashboard from "./Dashboard";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
