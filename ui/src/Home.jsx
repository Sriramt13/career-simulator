import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "80px 24px",
        display: "flex",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top, rgba(37,99,235,0.08), transparent 40%)"
      }}
    >
      <div style={{ maxWidth: "1100px", width: "100%" }}>
        {/* ================= HERO ================= */}
        <div style={{ textAlign: "center", marginBottom: "80px" }}>
          <h1
            style={{
              fontSize: "2.8rem",
              fontWeight: 700,
              background:
                "linear-gradient(90deg, #2563eb, #0f172a)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "20px"
            }}
          >
            Career Path Simulation System
          </h1>

          <p
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              fontSize: "1.05rem",
              color: "var(--text-muted)",
              lineHeight: "1.7"
            }}
          >
            A decision-support platform that simulates how careers evolve over
            time — capturing uncertainty, delays, failures, retries, and risk —
            instead of giving oversimplified career advice.
          </p>

          <button
            onClick={() => navigate("/dashboard")}
            style={{
              marginTop: "36px",
              padding: "14px 28px",
              fontSize: "1rem",
              fontWeight: 500,
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(37,99,235,0.25)"
            }}
          >
            🚀 Launch Simulation Dashboard
          </button>
        </div>

        {/* ================= FEATURE CARDS ================= */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "28px"
          }}
        >
          {[
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
          ].map((item, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(10px)",
                borderRadius: "16px",
                padding: "28px",
                border: "1px solid var(--border-soft)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
                transition: "transform 0.25s ease, box-shadow 0.25s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow =
                  "0 18px 40px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 12px 30px rgba(0,0,0,0.06)";
              }}
            >
              <h3 style={{ marginBottom: "10px" }}>{item.title}</h3>
              <p style={{ fontSize: "0.95rem" }}>{item.text}</p>
            </div>
          ))}
        </div>

        {/* ================= FOOT NOTE ================= */}
        <p
          style={{
            marginTop: "80px",
            textAlign: "center",
            fontSize: "0.8rem",
            color: "var(--text-muted)"
          }}
        >
          Built as a multi-domain career simulation engine for academic and
          real-world decision support.
        </p>
      </div>
    </div>
  );
}

export default Home;