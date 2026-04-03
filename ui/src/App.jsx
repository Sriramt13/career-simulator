import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";  

const Home = lazy(() => import("./Home"));
const Dashboard = lazy(() => import("./Dashboard"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-loader">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
