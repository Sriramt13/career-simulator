import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

/* ---------------- STAGE EXPLANATIONS ---------------- */

const STAGE_EXPLANATIONS = {
  Beginner: "Initial exposure and orientation phase",
  "Skill Learning": "Building required skills and knowledge",
  "Job Search": "Applying, interviews, and placement attempts",
  Preparation: "Focused preparation for exams or assessments",
  Attempt: "Actual exam or selection attempt",
  Freelancing: "Independent work and client acquisition",
  "MBA Program": "Formal management education",
  Placements: "Campus or off-campus placement process"
};

const DOMAIN_LABELS = {
  it: "IT Career",
  government_exam: "Government Exam",
  mba: "MBA / Management",
  creative: "Creative / Freelance"
};

function Dashboard() {
  const [activeView, setActiveView] = useState("simulation");

  const [domain, setDomain] = useState("it");
  const [hours, setHours] = useState("");
  const [learning, setLearning] = useState("medium");
  const [financial, setFinancial] = useState("low");

  const [compareA, setCompareA] = useState("it");
  const [compareB, setCompareB] = useState("mba");

  const [data, setData] = useState(null);
  const [compareDataA, setCompareDataA] = useState(null);
  const [compareDataB, setCompareDataB] = useState(null);

  const [activeCase, setActiveCase] = useState("best_case");

  /* ---------- DEFAULT THEME ---------- */
  useEffect(() => {
    document.body.setAttribute("data-theme", "light");
  }, []);

  /* ---------------- API ---------------- */

  const fetchSimulation = async (selectedDomain) => {
    const url = `http://127.0.0.1:8000/simulate?domain=${selectedDomain}&hours_per_day=${hours}&learning_speed=${learning}&financial_pressure=${financial}`;
    const res = await fetch(url, { method: "POST" });
    return await res.json();
  };

  const runSimulation = async () => {
    const result = await fetchSimulation(domain);
    setData(result);
    setActiveCase("best_case");
  };

  const runComparison = async () => {
    setCompareDataA(await fetchSimulation(compareA));
    setCompareDataB(await fetchSimulation(compareB));
  };

  const stageAnalyticsData =
    data &&
    data.scenarios?.[activeCase]?.timeline?.map((step) => ({
      stage: step.stage,
      months: step.months,
      risk: step.risk
    }));

  return (
    <div className="app-container">
      {/* ---------------- SIDEBAR ---------------- */}
      <div className="sidebar">
        <h2>Career Simulator</h2>

        {/* 🌗 THEME TOGGLE (FIXED & WORKING) */}
        <button
          style={{ marginBottom: "16px", width: "100%" }}
          onClick={() => {
            const current = document.body.getAttribute("data-theme");
            document.body.setAttribute(
              "data-theme",
              current === "dark" ? "light" : "dark"
            );
          }}
        >
          🌗 Theme Mode
        </button>

        {["simulation", "comparison", "analytics"].map((v) => (
          <div
            key={v}
            className={`sidebar-item ${activeView === v ? "active" : ""}`}
            onClick={() => setActiveView(v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </div>
        ))}
      </div>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <div className="main-content">

        {/* ================= SIMULATION ================= */}
        {activeView === "simulation" && (
          <>
            <div className="card" style={{ maxWidth: "360px" }}>
              <h3>Career Simulation</h3>

              <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Hours per day"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />

              <select value={learning} onChange={(e) => setLearning(e.target.value)}>
                <option value="slow">Slow</option>
                <option value="medium">Medium</option>
                <option value="fast">Fast</option>
              </select>

              <select value={financial} onChange={(e) => setFinancial(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <button onClick={runSimulation}>Run Simulation</button>
            </div>

            {data && (
              <div className="card">
                <h3>{DOMAIN_LABELS[domain]} Timeline</h3>

                {/* ---- CASE TOGGLE ---- */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  {["best_case", "average_case", "worst_case"].map((k) => (
                    <button
                      key={k}
                      className={activeCase === k ? "active-tab" : ""}
                      onClick={() => setActiveCase(k)}
                    >
                      {k.replace("_", " ").toUpperCase()}
                    </button>
                  ))}
                </div>

                {data.scenarios[activeCase].timeline.map((s, i) => {
                  const totalMonths = data.scenarios[activeCase].timeline
                    .reduce((sum, t) => sum + t.months, 0);

                  return (
                    <div key={i}>
                      <b>{s.stage}</b> ({s.months} months)
                      <p style={{ fontSize: "12px" }}>
                        {STAGE_EXPLANATIONS[s.stage]}
                      </p>
                      <div
                        className="stage-bar"
                        style={{
                          width: `${(s.months / totalMonths) * 100}%`,
                          background:
                            s.status === "failed"
                              ? "var(--risk-red)"
                              : "var(--success-green)"
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ================= COMPARISON ================= */}
        {activeView === "comparison" && (
          <>
            <div className="card" style={{ maxWidth: "360px" }}>
              <h3>Career Comparison</h3>

              <select value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <button onClick={runComparison}>Compare</button>
            </div>

            {compareDataA && compareDataB && (
              <div className="card" style={{ display: "flex", gap: "20px" }}>
                {[compareDataA, compareDataB].map((d, i) => (
                  <div key={i} className="card" style={{ background: "#f9fafb" }}>
                    <h4>{DOMAIN_LABELS[i === 0 ? compareA : compareB]}</h4>
                    <p>Best: {d.scenarios.best_case.total_months}</p>
                    <p>Average: {d.scenarios.average_case.total_months}</p>
                    <p>Worst: {d.scenarios.worst_case.total_months}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ================= ANALYTICS ================= */}
        {activeView === "analytics" && data && (
          <div className="card">
            <h3>Analytics — {DOMAIN_LABELS[domain]}</h3>

            <h4 style={{ marginTop: "20px" }}>Time to Outcome</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { name: "Best", months: data.scenarios.best_case.total_months },
                  { name: "Average", months: data.scenarios.average_case.total_months },
                  { name: "Worst", months: data.scenarios.worst_case.total_months }
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="months" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>

            {stageAnalyticsData && (
              <>
                <h4 style={{ marginTop: "40px" }}>Stage-wise Time Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stageAnalyticsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="stage" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="months" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>

                <h4 style={{ marginTop: "40px" }}>Risk Exposure by Stage</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stageAnalyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Bar dataKey="risk" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;