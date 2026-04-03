import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function Home() {
  const navigate = useNavigate();

  const features = [
    {
      title: "Simulation, Not Recommendation",
      text:
        "Careers are modeled as state-based systems with branching paths and multiple realistic outcomes."
    },
    {
      title: "Time & Risk Modeling",
      text:
        "Learning speed, failures, retries, financial pressure, and delays are explicitly simulated."
    },
    {
      title: "Explainable Outcomes",
      text:
        "Each outcome explains why it occurred and which assumptions influenced it the most."
    }
  ];

  return (
    <div className="home-shell">
      <div className="home-content">
        {/* ================= HERO ================= */}
        <motion.div
          className="home-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <h1 className="home-title"
          >
            Career Path Simulation System
          </h1>

          <p className="home-subtitle">
            A decision-support platform that simulates how careers evolve over
            time — capturing uncertainty, delays, failures, retries, and risk —
            instead of giving oversimplified career advice.
          </p>

          <motion.button
            onClick={() => navigate("/dashboard")}
            className="home-cta"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            🚀 Launch Simulation Dashboard
          </motion.button>
        </motion.div>

        {/* ================= FEATURE CARDS ================= */}
        <div className="home-grid">
          {features.map((item, i) => (
            <motion.div
              key={i}
              className="home-feature-card"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.1 }}
              whileHover={{ y: -7, scale: 1.01 }}
            >
              <h3 style={{ marginBottom: "10px" }}>{item.title}</h3>
              <p style={{ fontSize: "0.95rem" }}>{item.text}</p>
            </motion.div>
          ))}
        </div>

        {/* ================= FOOT NOTE ================= */}
        <p className="home-footer-note">
          Built as a multi-domain career simulation engine for academic and
          real-world decision support.
        </p>
      </div>
    </div>
  );
}

export default Home;