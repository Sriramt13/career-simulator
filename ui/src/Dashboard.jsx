import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import ReactFlow, { Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

/* ---------------- CONSTANTS ---------------- */

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
  higher_studies: "Higher Studies",
  startup: "Startup",
  creative: "Creative Career",
  freelancing: "Freelancing"
};

const API_URL = "https://career-simulator.onrender.com";

const CASE_KEYS = ["best_case", "average_case", "worst_case"];
const MIN_HOURS_PER_DAY = 1;
const MAX_HOURS_PER_DAY = 16;
const MIN_RUNS = 5;
const MAX_RUNS = 500;
const MAX_API_RETRIES = 5;
const HEALTH_CHECK_TIMEOUT = 60000;
const INITIAL_RETRY_DELAY = 1000;

const clampInt = (value, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const clamp01 = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
};

const normalizePayload = (payload) => ({
  ...payload,
  hours: clampInt(payload.hours, MIN_HOURS_PER_DAY, MAX_HOURS_PER_DAY),
  runs: clampInt(payload.runs, MIN_RUNS, MAX_RUNS)
});

const userFriendlyError = (error, actionLabel) => {
  if (error?.message === "unreachable") {
    return "Backend unreachable. Start the API server and try again.";
  }

  if (error?.message === "timeout") {
    return `The ${actionLabel} request timed out. Please retry.`;
  }

  if (typeof error?.message === "string" && error.message.startsWith("http_")) {
    const status = Number(error.message.replace("http_", ""));
    if (status === 400) {
      return "Invalid input. Ensure hours are 1-16 and runs are 5-500.";
    }
    if (status >= 500) {
      return "Server error occurred. Please retry in a moment.";
    }
    return `Request failed with status ${status}.`;
  }

  return `Unable to complete ${actionLabel}. Please retry.`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pageMotion = {
  initial: { opacity: 0, x: 24 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.32, ease: [0.4, 0, 1, 1] }
  }
};

const cardMotion = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
  }
};

const MotionButton = ({ className = "", children, ...rest }) => (
  <motion.button
    className={className}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    transition={{ duration: 0.18, ease: "easeOut" }}
    {...rest}
  >
    {children}
  </motion.button>
);

/* ---------------- COMPONENT ---------------- */

function Dashboard() {
  const [activeView, setActiveView] = useState("simulation");
  const [domainOptions, setDomainOptions] = useState(
    Object.entries(DOMAIN_LABELS).map(([key, name]) => ({ key, name }))
  );
  const [domainLoadError, setDomainLoadError] = useState("");

  /* ---- Simulation Inputs ---- */
  const [domain, setDomain] = useState("");
  const [hours, setHours] = useState("");
  const [learning, setLearning] = useState("");
  const [financial, setFinancial] = useState("");
  const [runs, setRuns] = useState(30);

  /* ---- Comparison Inputs ---- */
  const [compareA, setCompareA] = useState({
    domain: "it",
    hours: 3,
    learning: "medium",
    financial: "low"
  });

  const [compareB, setCompareB] = useState({
    domain: "higher_studies",
    hours: 3,
    learning: "medium",
    financial: "low"
  });

  /* ---- Results ---- */
  const [data, setData] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [activeCase, setActiveCase] = useState("best_case");
  const [loadingAction, setLoadingAction] = useState(null);
  const [simulationError, setSimulationError] = useState("");
  const [comparisonError, setComparisonError] = useState("");
  const [backendStatus, setBackendStatus] = useState("loading");
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [liveStatus, setLiveStatus] = useState({
    ui_version: "v2",
    status: "loading",
    simulation_engine: "starting"
  });
  const [liveStatusCheckedAt, setLiveStatusCheckedAt] = useState(null);
  const [autoRunOnLoad, setAutoRunOnLoad] = useState(false);
  const [selectedJourneyNodeId, setSelectedJourneyNodeId] = useState(null);
  const [journeyRouteIds, setJourneyRouteIds] = useState([]);
  const [journeyStepIndex, setJourneyStepIndex] = useState(0);
  const [journeyMonth, setJourneyMonth] = useState(0);
  const [manualTimelineMode, setManualTimelineMode] = useState(false);
  const [decisionMoment, setDecisionMoment] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [visitedEdgeIds, setVisitedEdgeIds] = useState([]);
  const [runReasons, setRunReasons] = useState([]);
  const [routeMonthMarks, setRouteMonthMarks] = useState([]);
  const [isAutoAnimating, setIsAutoAnimating] = useState(false);
  const [playbackSeed, setPlaybackSeed] = useState(0);
  const [failureStory, setFailureStory] = useState(null);
  const [isJourneyFullscreen, setIsJourneyFullscreen] = useState(false);
  
  /* ---- WHAT-IF CONTROLS ---- */
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfData, setWhatIfData] = useState(null);
  const [whatIfHours, setWhatIfHours] = useState(null);
  const [whatIfLearning, setWhatIfLearning] = useState(null);
  const [whatIfFinancial, setWhatIfFinancial] = useState(null);
  
  /* ---- EXPORT/SHARE ---- */
  const [shareMessage, setShareMessage] = useState("");
  const [altPathDomain, setAltPathDomain] = useState(null);
  
  const simulationRequestRef = useRef(0);
  const comparisonRequestRef = useRef(0);
  const autoRunTriggeredRef = useRef(false);
  const playbackTokenRef = useRef(0);
  const audioContextRef = useRef(null);
  const whatIfTimeoutRef = useRef(null);
  const journeyFlowWrapRef = useRef(null);

  useEffect(() => {
    document.body.setAttribute("data-theme", "light");
  }, []);

  useEffect(() => {
    if (!isJourneyFullscreen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsJourneyFullscreen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isJourneyFullscreen]);

  useEffect(() => {
    const scenarioMap = data?.scenarios;
    if (!scenarioMap) {
      setActiveCase("best_case");
      return;
    }

    const availableCases = CASE_KEYS.filter((key) => scenarioMap?.[key]);
    if (availableCases.length === 0) {
      setActiveCase("best_case");
      return;
    }

    if (!availableCases.includes(activeCase)) {
      setActiveCase(availableCases[0]);
    }
  }, [data, activeCase]);

  useEffect(() => {
    const loadDomains = async () => {
      try {
        const res = await fetch(`${API_URL}/domains`);
        if (!res.ok) return;
        const json = await res.json();
        if (!Array.isArray(json) || json.length === 0) return;

        const options = json
          .filter((item) => item?.key && item?.name)
          .map((item) => ({ key: item.key, name: item.name }));

        if (options.length === 0) return;

        setDomainOptions(options);
        setDomain(options[0].key);
        setCompareA((prev) => ({ ...prev, domain: options[0].key }));
        if (options[1]?.key) {
          setCompareB((prev) => ({ ...prev, domain: options[1].key }));
        } else {
          setCompareB((prev) => ({ ...prev, domain: options[0].key }));
        }
      } catch {
        setDomainLoadError("Domain metadata could not be fetched. Using local defaults.");
      }
    };

    loadDomains();
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      if (loadingAction) {
        setBackendStatus("loading");
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      try {
        const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
        setBackendStatus(res.ok ? "online" : "offline");
      } catch {
        setBackendStatus("offline");
      } finally {
        clearTimeout(timeoutId);
      }
    };

    checkHealth();
    const intervalId = setInterval(checkHealth, 15000);
    return () => clearInterval(intervalId);
  }, [loadingAction]);

  useEffect(() => {
    const checkLiveStatus = async () => {
      if (loadingAction) {
        setLiveStatus((prev) => ({
          ...prev,
          status: "loading",
          simulation_engine: "running"
        }));
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/status`);
        if (!res.ok) {
          throw new Error("http_status");
        }

        const json = await res.json();
        setLiveStatus({
          ui_version: typeof json?.ui_version === "string" ? json.ui_version : "v2",
          status: json?.status === "live" ? "live" : "loading",
          simulation_engine: json?.simulation_engine === "running" ? "running" : "starting"
        });
        setLiveStatusCheckedAt(new Date());
      } catch {
        setLiveStatus({
          ui_version: "v2",
          status: "offline",
          simulation_engine: "offline"
        });
        setLiveStatusCheckedAt(new Date());
      }
    };

    checkLiveStatus();
    const intervalId = setInterval(checkLiveStatus, 10000);
    return () => clearInterval(intervalId);
  }, [loadingAction]);

  /* ---------------- API ---------------- */

  const warmupBackend = async () => {
    try {
      setIsWarmingUp(true);
      const startTime = Date.now();
      
      for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt += 1) {
        try {
          const res = await fetch(`${API_URL}/health`, {
            signal: AbortSignal.timeout(5000)
          });
          if (res.ok) {
            setIsWarmingUp(false);
            return true;
          }
        } catch (err) {
          if (Date.now() - startTime > HEALTH_CHECK_TIMEOUT) {
            setIsWarmingUp(false);
            return false;
          }
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 8000)));
        }
      }
      setIsWarmingUp(false);
      return false;
    } catch (err) {
      setIsWarmingUp(false);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const prewarm = async () => {
      const isHealthy = await warmupBackend();
      if (!isMounted) return;
      setBackendStatus(isHealthy ? "online" : "offline");
    };

    prewarm();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchSimulation = async (payload) => {
    const safePayload = normalizePayload(payload);
    const shouldRetry = (error) => {
      if (error instanceof TypeError) return true;
      if (error?.message?.startsWith("http_")) {
        const status = Number(error.message.replace("http_", ""));
        return status >= 500 || status === 0;
      }
      return false;
    };

    for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt += 1) {
      try {
      const url = `${API_URL}/simulate`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domain: safePayload.domain,
          hours_per_day: safePayload.hours,
          learning_speed: safePayload.learning,
          financial_pressure: safePayload.financial,
          runs: safePayload.runs
        })
      });

      if (!res.ok) {
        throw new Error(`http_${res.status}`);
      }

      const json = await res.json();

      const normalizeScenario = (scenario) => {
        const rawTimeline = Array.isArray(scenario?.timeline) ? scenario.timeline : [];
        return {
          total_months: Number.isFinite(scenario?.total_months) ? scenario.total_months : 0,
          failures: Number.isFinite(scenario?.failures) ? scenario.failures : 0,
          timeline: rawTimeline
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              stage: item?.stage || "Unknown Stage",
              months: Number.isFinite(item?.months) ? item.months : 0,
              risk: Number.isFinite(item?.risk) ? item.risk : 0,
              status: item?.status || "success",
              note: item?.note || ""
            }))
        };
      };

      return {
        domain: json?.domain || safePayload.domain,
        inputs: json?.inputs || {},
        scenarios: {
          best_case: normalizeScenario(json?.scenarios?.best_case),
          average_case: normalizeScenario(json?.scenarios?.average_case),
          worst_case: normalizeScenario(json?.scenarios?.worst_case)
        },
        explanations: Array.isArray(json?.explanations)
          ? json.explanations.filter((x) => typeof x === "string")
          : [],
        scores: {
          risk_score: Number.isFinite(json?.scores?.risk_score) ? json.scores.risk_score : 0,
          effort_score: Number.isFinite(json?.scores?.effort_score) ? json.scores.effort_score : 0,
          stability_score: Number.isFinite(json?.scores?.stability_score) ? json.scores.stability_score : 0
        },
        analytics: {
          success_probability: Number.isFinite(json?.analytics?.success_probability)
            ? json.analytics.success_probability
            : 0,
          retry_probability: Number.isFinite(json?.analytics?.retry_probability)
            ? json.analytics.retry_probability
            : 0,
          burnout_probability: Number.isFinite(json?.analytics?.burnout_probability)
            ? json.analytics.burnout_probability
            : 0,
          bottleneck_stage: typeof json?.analytics?.bottleneck_stage === "string"
            ? json.analytics.bottleneck_stage
            : "-",
          bottleneck_avg_months: Number.isFinite(json?.analytics?.bottleneck_avg_months)
            ? json.analytics.bottleneck_avg_months
            : 0
        }
      };
    } catch (error) {
      if (error instanceof TypeError) {
        if (attempt < MAX_API_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await sleep(Math.min(delay, 8000));
          continue;
        }
        throw new Error("unreachable");
      }

      if (shouldRetry(error) && attempt < MAX_API_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        await sleep(Math.min(delay, 8000));
        continue;
      }

      throw error;
    }
    }

    throw new Error("unreachable");
  };

  const runSimulation = async () => {
    if (!domain || !learning || !financial || hours === "") {
      setSimulationError("Please fill all inputs: domain, hours per day, learning speed, and financial pressure.");
      return;
    }

    const safeDomain = domainOptions.some((d) => d.key === domain)
      ? domain
      : "";

    if (!safeDomain) {
      setSimulationError("Please select a valid career domain.");
      return;
    }

    const safeHours = clampInt(hours, MIN_HOURS_PER_DAY, MAX_HOURS_PER_DAY);
    const safeRuns = clampInt(runs, MIN_RUNS, MAX_RUNS);

    setDomain(safeDomain);
    setHours(safeHours);
    setRuns(safeRuns);

    simulationRequestRef.current += 1;
    const requestId = simulationRequestRef.current;

    setSimulationError("");
    setLoadingAction("simulation");
    setBackendStatus("loading");

    try {
      const result = await fetchSimulation({
        domain: safeDomain,
        hours: safeHours,
        learning,
        financial,
        runs: safeRuns
      });

      if (requestId !== simulationRequestRef.current) return;

      setData(result);
      setActiveCase("best_case");
      setBackendStatus("online");
    } catch (error) {
      if (requestId !== simulationRequestRef.current) return;

      setData(null);
      setSimulationError(userFriendlyError(error, "simulation"));
      if (error?.message === "unreachable") {
        setBackendStatus("offline");
      } else {
        setBackendStatus("online");
      }
    } finally {
      if (requestId === simulationRequestRef.current) {
        setLoadingAction(null);
      }
    }
  };

  const runComparison = async () => {
    const safeRuns = clampInt(runs, MIN_RUNS, MAX_RUNS);
    setRuns(safeRuns);

    const safeA = normalizePayload({ ...compareA, runs: safeRuns });
    const safeB = normalizePayload({ ...compareB, runs: safeRuns });

    setCompareA((prev) => ({ ...prev, hours: safeA.hours }));
    setCompareB((prev) => ({ ...prev, hours: safeB.hours }));

    comparisonRequestRef.current += 1;
    const requestId = comparisonRequestRef.current;

    setComparisonError("");
    setLoadingAction("comparison");
    setBackendStatus("loading");

    try {
      const [a, b] = await Promise.all([
        fetchSimulation(safeA),
        fetchSimulation(safeB)
      ]);

      if (requestId !== comparisonRequestRef.current) return;

      setCompareData({ a, b });
      setBackendStatus("online");
    } catch (error) {
      if (requestId !== comparisonRequestRef.current) return;

      setCompareData(null);
      setComparisonError(userFriendlyError(error, "comparison"));
      if (error?.message === "unreachable") {
        setBackendStatus("offline");
      } else {
        setBackendStatus("online");
      }
    } finally {
      if (requestId === comparisonRequestRef.current) {
        setLoadingAction(null);
      }
    }
  };

  /* ---- WHAT-IF LIVE PREVIEW ---- */
  useEffect(() => {
    if (!whatIfMode || (!whatIfHours && !whatIfLearning && !whatIfFinancial)) {
      setWhatIfData(null);
      return;
    }

    if (whatIfTimeoutRef.current) {
      clearTimeout(whatIfTimeoutRef.current);
    }

    whatIfTimeoutRef.current = setTimeout(async () => {
      try {
        const adjustedHours = whatIfHours !== null ? whatIfHours : hours;
        const adjustedLearning = whatIfLearning !== null ? whatIfLearning : learning;
        const adjustedFinancial = whatIfFinancial !== null ? whatIfFinancial : financial;

        const result = await fetchSimulation({
          domain,
          hours: adjustedHours,
          learning: adjustedLearning,
          financial: adjustedFinancial,
          runs: Math.min(50, runs) // Fewer runs for live preview
        });

        setWhatIfData(result);
      } catch (error) {
        setWhatIfData(null);
      }
    }, 800);

    return () => {
      if (whatIfTimeoutRef.current) {
        clearTimeout(whatIfTimeoutRef.current);
      }
    };
  }, [whatIfMode, whatIfHours, whatIfLearning, whatIfFinancial, hours, learning, financial, domain, runs]);

  /* ---- EXPORT/SHARE FUNCTIONS ---- */
  const exportToPDF = async () => {
    try {
      if (!hasSimulationData) {
        setShareMessage("⚠️ Run simulation first, then export PDF.");
        setTimeout(() => setShareMessage(""), 3000);
        return;
      }

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageHeight = 297;
      const marginX = 14;
      const maxWidth = 182;
      let y = 16;
      const safePdfText = (value) => String(value ?? "")
        .normalize("NFKD")
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const ensureSpace = (needed = 8) => {
        if (y + needed <= pageHeight - 14) return;
        doc.addPage();
        y = 16;
      };

      const addLine = (text, opts = {}) => {
        const size = opts.size || 11;
        const weight = opts.bold ? "bold" : "normal";
        doc.setFont("helvetica", weight);
        doc.setFontSize(size);

        const lines = doc.splitTextToSize(safePdfText(text), opts.width || maxWidth);
        const lineHeight = opts.lineHeight || (size <= 10 ? 5 : 6);
        ensureSpace(lines.length * lineHeight + 2);
        doc.text(lines, marginX, y);
        y += lines.length * lineHeight;
      };

      addLine("Career Simulation Report", { size: 18, bold: true });
      addLine(`Generated: ${new Date().toLocaleString()}`, { size: 9 });
      y += 2;

      addLine(`Domain: ${labelFor(domain)}`, { size: 11, bold: true });
      addLine(`Case: ${activeCase.replace("_", " ").toUpperCase()}`, { size: 10 });
      addLine(`Success Probability: ${Number(successProbabilityValue || 0).toFixed(1)}%`, { size: 10 });
      addLine(`Total Duration: ${Number(activeCaseMonths || 0).toFixed(2)} months`, { size: 10 });
      addLine(`Inputs: ${hours} hrs/day, learning ${learning}, financial ${financial}, runs ${runs}`, { size: 10 });
      y += 4;

      addLine("Timeline Breakdown", { size: 13, bold: true });
      ensureSpace(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("#", 14, y);
      doc.text("Stage", 24, y);
      doc.text("Months", 130, y);
      doc.text("Risk", 160, y);
      y += 4;
      doc.setLineWidth(0.2);
      doc.line(14, y, 196, y);
      y += 5;

      if (activeTimeline.length === 0) {
        addLine("No timeline data available.", { size: 10 });
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        activeTimeline.forEach((stage, idx) => {
          ensureSpace(8);
          const stageName = safePdfText(stage?.stage || `Stage ${idx + 1}`);
          const shortName = doc.splitTextToSize(stageName, 98)[0] || stageName;
          const months = Number(stage?.months || 0).toFixed(2);
          const risk = `${(clamp01(stage?.risk || 0) * 100).toFixed(0)}%`;

          doc.text(String(idx + 1), 14, y);
          doc.text(shortName, 24, y);
          doc.text(months, 130, y);
          doc.text(risk, 160, y);
          y += 6;
        });
      }

      y += 3;
      addLine("Key Insights", { size: 13, bold: true });

      const timelineAverage = activeCaseMonths ? Number(activeCaseMonths).toFixed(1) : "0.0";
      const successRate = Number(successProbabilityValue || 0).toFixed(1);
      const retryRate = Number((failurePathsAnalysis?.failThenRetry || 0) * 100).toFixed(1);
      const burnoutRate = Number((failurePathsAnalysis?.failThenBurnout || 0) * 100).toFixed(1);
      const bestStage = activeTimeline.reduce((best, stage) => {
        if (!best || (stage?.months || 0) > (best?.months || 0)) return stage;
        return best;
      }, null);

      const insightItems = [
        `Average timeline: ${timelineAverage} months`,
        `Success probability: ${successRate}%`,
        `Retry risk: ${retryRate}%`,
        `Burnout risk: ${burnoutRate}%`,
        bestStage ? `Longest stage: ${safePdfText(bestStage.stage || "Unknown")}` : "Longest stage: Not available",
        `Risk level: ${avgRiskPercent >= 65 ? "High" : avgRiskPercent >= 35 ? "Medium" : "Low"}`,
        `Stability: ${stabilityBand}`
      ];

      insightItems.forEach((item) => {
        addLine(`- ${item}`, { size: 10, lineHeight: 5 });
      });

      y += 2;
      addLine(`Failure Path Split: Success ${((failurePathsAnalysis?.success || 0) * 100).toFixed(1)}%, Retry ${((failurePathsAnalysis?.failThenRetry || 0) * 100).toFixed(1)}%, Burnout ${((failurePathsAnalysis?.failThenBurnout || 0) * 100).toFixed(1)}%.`, { size: 10 });

      const pdfBlob = doc.output("blob");
      if (!pdfBlob || pdfBlob.size < 1024) {
        throw new Error("pdf_generation_failed");
      }

      const fileName = `career-simulation-${new Date().toISOString().slice(0, 10)}-${Date.now()}.pdf`;
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);

      setShareMessage("✅ PDF downloaded successfully!");
      setTimeout(() => setShareMessage(""), 3000);
    } catch (error) {
      setShareMessage("⚠️ Export failed. Check browser console.");
      console.error("PDF export error:", error);
      setTimeout(() => setShareMessage(""), 3000);
    }
  };

  const generateShareLink = () => {
    try {
      const shareData = {
        domain,
        hours,
        learning,
        financial,
        activeCase
      };
      const encoded = btoa(JSON.stringify(shareData));
      const link = `${window.location.origin}?sim=${encoded}`;
      
      navigator.clipboard.writeText(link);
      setShareMessage('✅ Share link copied to clipboard!');
      setTimeout(() => setShareMessage(''), 3000);
    } catch (error) {
      setShareMessage('⚠️ Failed to copy link.');
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  const simulateAlternativePath = () => {
    if (!altPathDomain || altPathDomain === domain) return;
    setDomain(altPathDomain);
    setActiveCase('best_case');
    runSimulation();
    setAltPathDomain(null);
  };

  /* ---- DYNAMIC EXPLAINABILITY ---- */
  const generateDynamicReasons = (
    hoursVal,
    learningVal,
    financialVal,
    currentData
  ) => {
    const reasons = [];

    // Hours impact
    if (hoursVal < 2) {
      reasons.push("❌ Very low hours/day → Extremely slow progression, high delay risk");
    } else if (hoursVal < 4) {
      reasons.push("🟡 Low hours/day → Slower skill acquisition, extended timeline");
    } else if (hoursVal >= 6 && hoursVal <= 8) {
      reasons.push("✅ Moderate hours/day → Consistent skill development");
    } else if (hoursVal > 10) {
      reasons.push("⚡ High hours/day → Faster progression but burnout risk ⚠️");
    }

    // Learning speed impact
    if (learningVal === "slow") {
      reasons.push("📚 Slow learner → More repetition needed, longer preparation phases");
    } else if (learningVal === "fast") {
      reasons.push("🧠 Fast learner → Quick skill acquisition, shorter bottlenecks");
    } else {
      reasons.push("📖 Medium learner → Balanced progression, moderate timeline");
    }

    // Financial pressure impact
    if (financialVal === "high") {
      reasons.push("💰 High financial pressure → Must move faster, lower failure tolerance");
    } else if (financialVal === "low") {
      reasons.push("💡 Low financial pressure → More flexibility, can retry if needed");
    } else {
      reasons.push("💼 Medium financial pressure → Balanced risk-reward tradeoff");
    }

    // Success probability insight
    if (currentData?.analytics?.success_probability) {
      const successProb = currentData.analytics.success_probability;
      if (successProb > 80) {
        reasons.push("✨ HIGH SUCCESS PROBABILITY → This path is well-suited for your profile");
      } else if (successProb < 40) {
        reasons.push("⚠️ LOW SUCCESS PROBABILITY → Consider increasing hours or learning speed");
      }
    }

    return reasons;
  };

  /* ---- FAILURE STORY GENERATOR ---- */
  const generateFailureStory = () => {
    if (!journeyRouteIds.includes("outcome_failure")) return null;

    const reasons = [];
    const improvements = [];

    if (hours < 3) {
      reasons.push(`Low time commitment (${hours} hours/day) → extended timeline`);
      improvements.push("💡 Increase to 4-5 hours/day for faster progression");
    }
    if (hours > 10) {
      reasons.push("High work hours may cause fatigue and reduced learning efficiency");
      improvements.push("💡 Consider 7-8 hours/day for sustainable progress");
    }
    if (learning === "slow") {
      reasons.push("Slow learning pace → longer preparation phases needed");
      improvements.push("💡 Focus on foundational concepts with spaced repetition");
    }
    if (financial === "high") {
      reasons.push("High financial pressure → rushed attempts without proper preparation");
      improvements.push("💡 Take 1-2 extra months to build confidence before attempting");
    }

    const bottleneckStage = activeTimeline.reduce((max, stage) => {
      if (!max || (stage?.months || 0) > (max?.months || 0)) return stage;
      return max;
    }, null);

    if (bottleneckStage) {
      reasons.push(`Bottleneck: "${bottleneckStage.stage}" took too long`);
      improvements.push(`💡 For "${bottleneckStage.stage}": allocate more focused study time`);
    }

    if (reasons.length === 0) {
      reasons.push("External factors or timing issues");
      improvements.push("💡 Consider adjusting when you attempt (economic conditions, market timing, etc.)");
    }

    return {
      reasons,
      improvements,
      avgMonths: activeCaseMonths.toFixed(1)
    };
  };

  /* ---- FAILURE PATHS ANALYSIS ---- */
  const scenarios = data?.scenarios || {};
  const hasScenarioData = CASE_KEYS.some((key) => Boolean(scenarios?.[key]));

  const activeTimeline = scenarios?.[activeCase]?.timeline ?? [];
  const activeTotalMonths = activeTimeline.reduce(
    (sum, stage) => sum + (stage?.months || 0),
    0
  );
  const activeCaseMonths = Number.isFinite(scenarios?.[activeCase]?.total_months)
    ? scenarios?.[activeCase]?.total_months
    : activeTotalMonths;
  const hasSimulationData = hasScenarioData;
  const successProbabilityValue = Number.isFinite(data?.analytics?.success_probability)
    ? data.analytics.success_probability
    : 0;
  const retryProbabilityValue = Number.isFinite(data?.analytics?.retry_probability)
    ? data.analytics.retry_probability
    : 0;
  const burnoutProbabilityValue = Number.isFinite(data?.analytics?.burnout_probability)
    ? data.analytics.burnout_probability
    : 0;

  const failurePathsAnalysis = useMemo(() => {
    if (!hasSimulationData) return null;

    const currentSuccessProb = clamp01(successProbabilityValue / 100);
    const retryProb = clamp01(retryProbabilityValue / 100);
    const burnoutProb = clamp01(burnoutProbabilityValue / 100);
    const failureProb = clamp01(retryProb + burnoutProb);
    const retryBias = failureProb > 0 ? clamp01(retryProb / failureProb) : 0;

    return {
      success: currentSuccessProb,
      failThenRetry: retryProb,
      failThenBurnout: burnoutProb,
      totalFailures: failureProb,
      avgRetries: Math.ceil(failureProb * retryBias * 2),
      burnoutRisk: Math.ceil((1 - retryBias) * 100)
    };
  }, [hasSimulationData, successProbabilityValue, retryProbabilityValue, burnoutProbabilityValue]);

  const journeyWidth = 1120;
  const journeyHeight = 420;

  const branchProbabilities = useMemo(() => {
    const successProb = clamp01(successProbabilityValue / 100);
    const retryAbsolute = clamp01(retryProbabilityValue / 100);
    const burnoutAbsolute = clamp01(burnoutProbabilityValue / 100);
    const failureProb = clamp01(retryAbsolute + burnoutAbsolute);
    const retryProb = failureProb > 0 ? clamp01(retryAbsolute / failureProb) : 0;
    const burnoutProb = failureProb > 0 ? clamp01(burnoutAbsolute / failureProb) : 0;

    return {
      success: successProb,
      failure: failureProb,
      retry: retryProb,
      burnout: burnoutProb
    };
  }, [successProbabilityValue, retryProbabilityValue, burnoutProbabilityValue]);

  const journeyGraph = useMemo(() => {
    const laneY = 170;
    const stageStartX = 170;
    const stageGap = 145;

    const stageNodes = activeTimeline.map((stage, index) => {
      const risk = clamp01(stage?.risk || 0);
      const yOffset = Math.round((risk - 0.5) * 90);
      const id = `stage_${index}`;
      
      // Risk-based heatmap coloring
      let riskColor = '#22c55e'; // green - low risk
      let glowColor = 'rgba(34, 197, 94, 0.3)'; // green glow
      if (risk > 0.6) {
        riskColor = '#ef4444'; // red - high risk
        glowColor = 'rgba(239, 68, 68, 0.3)'; // red glow
      } else if (risk > 0.3) {
        riskColor = '#f59e0b'; // orange - medium risk
        glowColor = 'rgba(245, 158, 11, 0.3)'; // orange glow
      }
      
      return {
        id,
        type: "default",
        position: { x: stageStartX + index * stageGap, y: laneY + yOffset },
        data: {
          label: (
            <div className="rf-node-label" title={`${stage?.stage || "Unknown Stage"}: ${(stage?.months || 0).toFixed(1)} months, risk ${(risk * 100).toFixed(0)}%`}>
              <strong>{stage?.stage || "Unknown Stage"}</strong>
              <span>{(stage?.months || 0).toFixed(1)} mo</span>
            </div>
          ),
          detail: {
            title: stage?.stage || "Unknown Stage",
            type: "Timeline Stage",
            risk: Math.round(risk * 100),
            months: Number(stage?.months || 0),
            note: stage?.note || STAGE_EXPLANATIONS[stage?.stage] || "Simulation stage",
            riskLevel: risk > 0.6 ? 'high' : risk > 0.3 ? 'medium' : 'low'
          }
        },
        style: {
          borderColor: riskColor,
          borderWidth: 2,
          boxShadow: `0 0 15px ${glowColor}, 0 12px 24px rgba(15, 23, 42, 0.12)`
        },
        className: `rf-node rf-node-stage rf-node-risk-${risk > 0.6 ? 'high' : risk > 0.3 ? 'medium' : 'low'}`,
        sourcePosition: "right",
        targetPosition: "left"
      };
    });

    const startNode = {
      id: "start",
      type: "input",
      position: { x: 24, y: laneY },
      data: {
        label: (
          <div className="rf-node-label" title="Journey starts from your current profile inputs.">
            <strong>Start</strong>
            <span>Profile</span>
          </div>
        ),
        detail: {
          title: "Start",
          type: "Input State",
          months: 0,
          risk: 0,
          note: "Domain, learning pace, and daily effort define this starting state."
        }
      },
      className: "rf-node rf-node-start",
      sourcePosition: "right"
    };

    const successNode = {
      id: "outcome_success",
      position: { x: stageStartX + Math.max(activeTimeline.length, 1) * stageGap + 110, y: laneY - 95 },
      data: {
        label: (
          <div className="rf-node-label" title="Target career outcome reached.">
            <strong>Success</strong>
            <span>Offer / Placement</span>
          </div>
        ),
        detail: {
          title: "Success Outcome",
          type: "Terminal State",
          months: Number(activeCaseMonths || 0),
          risk: Math.round(branchProbabilities.success * 100),
          note: "Path completes with successful transition into the selected domain."
        }
      },
      className: "rf-node rf-node-success",
      targetPosition: "left"
    };

    const failureNode = {
      id: "outcome_failure",
      position: { x: stageStartX + Math.max(activeTimeline.length, 1) * stageGap + 110, y: laneY + 95 },
      data: {
        label: (
          <div className="rf-node-label" title="Primary attempt did not convert, requiring recovery strategy.">
            <strong>Failed Attempt</strong>
            <span>Needs Recovery</span>
          </div>
        ),
        detail: {
          title: "Failure Outcome",
          type: "Branch State",
          months: Number(activeCaseMonths || 0),
          risk: Math.round(branchProbabilities.failure * 100),
          note: "This branch appears when attempts fail due to risk-heavy phases or bottlenecks."
        }
      },
      className: "rf-node rf-node-fail",
      sourcePosition: "right",
      targetPosition: "left"
    };

    const retryNode = {
      id: "outcome_retry",
      position: { x: stageStartX + Math.max(activeTimeline.length, 1) * stageGap + 330, y: laneY + 30 },
      data: {
        label: (
          <div className="rf-node-label" title="Retry after better preparation.">
            <strong>Retry Path</strong>
            <span>Adapt Plan</span>
          </div>
        ),
        detail: {
          title: "Retry Branch",
          type: "Recovery State",
          months: Number(activeCaseMonths || 0) + 2,
          risk: Math.round(branchProbabilities.retry * 100),
          note: "A second attempt is chosen after strategy correction and gap-filling."
        }
      },
      className: "rf-node rf-node-retry",
      targetPosition: "left"
    };

    const burnoutNode = {
      id: "outcome_burnout",
      position: { x: stageStartX + Math.max(activeTimeline.length, 1) * stageGap + 330, y: laneY + 170 },
      data: {
        label: (
          <div className="rf-node-label" title="Journey paused due to stress or constraints.">
            <strong>Burnout Risk</strong>
            <span>Exit / Delay</span>
          </div>
        ),
        detail: {
          title: "Burnout Branch",
          type: "Failure State",
          months: Number(activeCaseMonths || 0) + 1,
          risk: Math.round(branchProbabilities.burnout * 100),
          note: "Sustained high pressure without adaptation can defer or derail transition."
        }
      },
      className: "rf-node rf-node-burnout",
      targetPosition: "left"
    };

    const nodes = [
      startNode,
      ...stageNodes,
      successNode,
      failureNode,
      retryNode,
      burnoutNode
    ];

    const probabilityLabel = (value, label, tone) => (
      <span className={`rf-edge-label ${tone || ""}`} title={`${label}: ${(value * 100).toFixed(1)}%`}>
        {label} ({(value * 100).toFixed(0)}%)
      </span>
    );

    const stageEdges = [];
    const firstStageId = stageNodes[0]?.id;
    if (firstStageId) {
      stageEdges.push({
        id: "e_start_stage_0",
        source: "start",
        target: firstStageId,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#1d4ed8", strokeWidth: 3 }
      });
    }

    for (let idx = 0; idx < Math.max(stageNodes.length - 1, 0); idx += 1) {
      stageEdges.push({
        id: `e_stage_${idx}_${idx + 1}`,
        source: stageNodes[idx].id,
        target: stageNodes[idx + 1].id,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#2563eb", strokeWidth: 2.7 }
      });
    }

    const lastNodeId = stageNodes[stageNodes.length - 1]?.id || "start";
    const branchEdges = [
      {
        id: "e_branch_success",
        source: lastNodeId,
        target: "outcome_success",
        label: probabilityLabel(branchProbabilities.success, "Success", "success"),
        labelBgPadding: [8, 3],
        labelBgBorderRadius: 8,
        labelBgStyle: { fill: "rgba(255, 255, 255, 0.96)" },
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#16a34a" },
        style: {
          stroke: "#16a34a",
          strokeWidth: 2 + branchProbabilities.success * 5
        }
      },
      {
        id: "e_branch_failure",
        source: lastNodeId,
        target: "outcome_failure",
        label: probabilityLabel(branchProbabilities.failure, "Fail", "fail"),
        labelBgPadding: [8, 3],
        labelBgBorderRadius: 8,
        labelBgStyle: { fill: "rgba(255, 255, 255, 0.96)" },
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#dc2626" },
        style: {
          stroke: "#dc2626",
          strokeWidth: 2 + branchProbabilities.failure * 5
        }
      },
      {
        id: "e_branch_retry",
        source: "outcome_failure",
        target: "outcome_retry",
        label: probabilityLabel(branchProbabilities.retry, "Retry", "retry"),
        labelBgPadding: [8, 3],
        labelBgBorderRadius: 8,
        labelBgStyle: { fill: "rgba(255, 255, 255, 0.96)" },
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#d97706" },
        style: {
          stroke: "#d97706",
          strokeDasharray: "6 5",
          strokeWidth: 1.7 + branchProbabilities.retry * 4
        }
      },
      {
        id: "e_branch_burnout",
        source: "outcome_failure",
        target: "outcome_burnout",
        label: probabilityLabel(branchProbabilities.burnout, "Burnout", "burnout"),
        labelBgPadding: [8, 3],
        labelBgBorderRadius: 8,
        labelBgStyle: { fill: "rgba(255, 255, 255, 0.96)" },
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#7c3aed" },
        style: {
          stroke: "#7c3aed",
          strokeDasharray: "6 5",
          strokeWidth: 1.7 + branchProbabilities.burnout * 4
        }
      }
    ];

    const edges = [...stageEdges, ...branchEdges];
    const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const stageNodeIds = stageNodes.map((node) => node.id);
    const attemptNodeId = stageNodes.find((node) =>
      String(node?.data?.detail?.title || "").toLowerCase().includes("attempt")
    )?.id || stageNodeIds[stageNodeIds.length - 1] || "start";

    return { nodes, edges, nodeMap, stageNodeIds, attemptNodeId };
  }, [activeTimeline, activeCaseMonths, branchProbabilities]);

  const edgeLookupMap = useMemo(
    () => new Map(journeyGraph.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.id])),
    [journeyGraph.edges]
  );

  const displayedJourneyNodes = useMemo(
    () => journeyGraph.nodes.map((node) => ({
      ...node,
      className: `${node.className || ""} ${
        journeyRouteIds[journeyStepIndex] === node.id ? "rf-node-current" : ""
      } ${selectedJourneyNodeId === node.id ? "rf-node-selected" : ""}`.trim()
    })),
    [journeyGraph.nodes, journeyRouteIds, journeyStepIndex, selectedJourneyNodeId]
  );

  const displayedJourneyEdges = useMemo(
    () => journeyGraph.edges.map((edge) => {
      const isActive = edge.id === activeEdgeId;
      const isVisited = visitedEdgeIds.includes(edge.id);
      const baseWidth = Number(edge?.style?.strokeWidth || 2);

      return {
        ...edge,
        animated: isActive || isVisited,
        style: {
          ...edge.style,
          opacity: isActive ? 1 : (isVisited ? 0.84 : 0.2),
          strokeWidth: isActive ? baseWidth + 2.2 : (isVisited ? baseWidth + 0.4 : Math.max(1, baseWidth - 1.2)),
          strokeDasharray: isActive ? "8 6" : edge?.style?.strokeDasharray
        },
        className: isActive ? "rf-edge-active" : (isVisited ? "rf-edge-visited" : "rf-edge-muted")
      };
    }),
    [journeyGraph.edges, activeEdgeId, visitedEdgeIds]
  );

  const journeyGhostRoutes = useMemo(() => {
    if (!hasSimulationData || !journeyGraph.stageNodeIds.length) return [];

    const centerOf = (nodeId) => {
      const node = journeyGraph.nodeMap[nodeId];
      if (!node) return null;
      return {
        x: node.position.x + 58,
        y: node.position.y + 28
      };
    };

    const baseRoute = ["start", ...journeyGraph.stageNodeIds];
    const routes = [];

    for (let idx = 0; idx < 100; idx += 1) {
      const pseudo = ((idx * 73 + activeTimeline.length * 17 + Math.floor(successProbabilityValue * 10)) % 1000) / 1000;
      const successRoll = pseudo < branchProbabilities.success;
      const retryPseudo = ((idx * 91 + 17) % 1000) / 1000;
      const route = successRoll
        ? [...baseRoute, "outcome_success"]
        : [
            ...baseRoute,
            "outcome_failure",
            retryPseudo < branchProbabilities.retry ? "outcome_retry" : "outcome_burnout"
          ];

      const points = route
        .map((nodeId, pointIndex) => {
          const base = centerOf(nodeId);
          if (!base) return null;
          const jitterSeed = ((idx * 37 + pointIndex * 19) % 100) / 100;
          const jitterY = (jitterSeed - 0.5) * 16;
          return `${base.x},${(base.y + jitterY).toFixed(1)}`;
        })
        .filter(Boolean)
        .join(" ");

      if (points.length > 0) {
        routes.push({
          id: `ghost_${idx}`,
          points,
          success: successRoll,
          opacity: successRoll ? 0.05 : 0.045
        });
      }
    }

    return routes;
  }, [
    hasSimulationData,
    journeyGraph.nodeMap,
    journeyGraph.stageNodeIds,
    activeTimeline.length,
    successProbabilityValue,
    branchProbabilities.success,
    branchProbabilities.retry
  ]);

  const timelineSliderMax = Math.max(1, Number((activeCaseMonths + 3).toFixed(1)));

  const selectedJourneyNode = selectedJourneyNodeId
    ? journeyGraph.nodeMap[selectedJourneyNodeId] || null
    : null;

  const journeyMarkerPosition = useMemo(() => {
    const nodeId = journeyRouteIds[journeyStepIndex];
    if (!nodeId) return null;
    const node = journeyGraph.nodeMap[nodeId];
    if (!node) return null;
    return {
      x: node.position.x + 58,
      y: node.position.y + 28
    };
  }, [journeyGraph.nodeMap, journeyRouteIds, journeyStepIndex]);

  const bestCaseTimeline = scenarios?.best_case?.timeline ?? [];
  const hasBestCaseTimeline = bestCaseTimeline.length > 0;

  const stageAnalyticsData = bestCaseTimeline.map((s) => ({
      stage: s.stage,
      months: s?.months || 0,
      risk: s?.risk || 0
    }));

  const scenarioComparisonData = CASE_KEYS
    .filter((key) => scenarios?.[key])
    .map((key) => ({
    scenario: key.replace("_", " ").toUpperCase(),
    months: scenarios?.[key]?.total_months || 0,
    failures: scenarios?.[key]?.failures || 0
  }));

  /* ---- NEW ANALYTICS DATA ---- */
  const timelineProgressionData = useMemo(() => {
    let cumulative = 0;
    return bestCaseTimeline.map((s, idx) => {
      cumulative += s?.months || 0;
      return {
        stage: s.stage.substring(0, 12),
        cumulativeMonths: cumulative,
        stageMonths: s?.months || 0,
        risk: (s?.risk || 0) * 100
      };
    });
  }, [bestCaseTimeline]);

  const probabilityDistributionData = useMemo(() => {
    return [
      { name: "Success", value: Math.round(branchProbabilities.success * 100) },
      { name: "Retry", value: Math.round(retryProbabilityValue) },
      { name: "Burnout / Exit", value: Math.round(burnoutProbabilityValue) }
    ];
  }, [branchProbabilities, retryProbabilityValue, burnoutProbabilityValue]);

  const failurePathsPieData = useMemo(() => {
    if (!failurePathsAnalysis) return [];
    return [
      { name: "Success", value: Number((failurePathsAnalysis.success * 100).toFixed(1)), color: "#22c55e" },
      { name: "Fail → Retry", value: Number((failurePathsAnalysis.failThenRetry * 100).toFixed(1)), color: "#f59e0b" },
      { name: "Fail → Burnout/Exit", value: Number((failurePathsAnalysis.failThenBurnout * 100).toFixed(1)), color: "#ef4444" }
    ];
  }, [failurePathsAnalysis]);

  const hasComparisonData = Boolean(compareData?.a?.scenarios && compareData?.b?.scenarios);
  const averageMonthsA = compareData?.a?.scenarios?.average_case?.total_months ?? null;
  const averageMonthsB = compareData?.b?.scenarios?.average_case?.total_months ?? null;
  const comparisonDelta =
    Number.isFinite(averageMonthsA) && Number.isFinite(averageMonthsB)
      ? Math.abs(averageMonthsA - averageMonthsB)
      : null;
  const comparisonWinner =
    Number.isFinite(averageMonthsA) && Number.isFinite(averageMonthsB)
      ? (averageMonthsA === averageMonthsB
          ? "Tie"
          : (averageMonthsA < averageMonthsB ? "Career A" : "Career B"))
      : null;
  const compareDomainNameA = domainOptions.find((d) => d.key === compareA.domain)?.name || DOMAIN_LABELS[compareA.domain] || compareA.domain;
  const compareDomainNameB = domainOptions.find((d) => d.key === compareB.domain)?.name || DOMAIN_LABELS[compareB.domain] || compareB.domain;
  const compareRiskPctA = hasComparisonData
    ? ((compareData?.a?.scenarios?.average_case?.timeline || []).reduce((sum, stage) => sum + Number(stage?.risk || 0), 0) /
      Math.max(1, (compareData?.a?.scenarios?.average_case?.timeline || []).length)) * 100
    : 0;
  const compareRiskPctB = hasComparisonData
    ? ((compareData?.b?.scenarios?.average_case?.timeline || []).reduce((sum, stage) => sum + Number(stage?.risk || 0), 0) /
      Math.max(1, (compareData?.b?.scenarios?.average_case?.timeline || []).length)) * 100
    : 0;
  const compareRiskLabelA = compareRiskPctA >= 60 ? "High" : compareRiskPctA >= 35 ? "Medium" : "Low";
  const compareRiskLabelB = compareRiskPctB >= 60 ? "High" : compareRiskPctB >= 35 ? "Medium" : "Low";
  const compareStabilityA = Number(compareData?.a?.scores?.stability_score || 0);
  const compareStabilityB = Number(compareData?.b?.scores?.stability_score || 0);
  const compareStabilityLabelA = compareStabilityA >= 70 ? "High" : compareStabilityA >= 40 ? "Moderate" : "Low";
  const compareStabilityLabelB = compareStabilityB >= 70 ? "High" : compareStabilityB >= 40 ? "Moderate" : "Low";
  const comparisonChartData = hasComparisonData
    ? [
        {
          scenario: "Best",
          a: Number(compareData?.a?.scenarios?.best_case?.total_months || 0),
          b: Number(compareData?.b?.scenarios?.best_case?.total_months || 0)
        },
        {
          scenario: "Average",
          a: Number(compareData?.a?.scenarios?.average_case?.total_months || 0),
          b: Number(compareData?.b?.scenarios?.average_case?.total_months || 0)
        },
        {
          scenario: "Worst",
          a: Number(compareData?.a?.scenarios?.worst_case?.total_months || 0),
          b: Number(compareData?.b?.scenarios?.worst_case?.total_months || 0)
        }
      ]
    : [];
  const fasterCareerLabel = comparisonWinner === "Career A" ? compareDomainNameA : comparisonWinner === "Career B" ? compareDomainNameB : "Tie";
  const higherRiskCareerLabel = compareRiskPctA === compareRiskPctB ? "Tie" : (compareRiskPctA > compareRiskPctB ? compareDomainNameA : compareDomainNameB);
  const stableCareerLabel = compareStabilityA === compareStabilityB ? "Tie" : (compareStabilityA > compareStabilityB ? compareDomainNameA : compareDomainNameB);
  const miniTimelineA = (compareData?.a?.scenarios?.average_case?.timeline || []).slice(0, 4).map((s) => s?.stage || "Stage").join(" -> ");
  const miniTimelineB = (compareData?.b?.scenarios?.average_case?.timeline || []).slice(0, 4).map((s) => s?.stage || "Stage").join(" -> ");
  const recommendationSummary = hasComparisonData
    ? `${fasterCareerLabel} is ${comparisonDelta ? `${(Math.max(averageMonthsA || 0, averageMonthsB || 0) / Math.max(0.1, Math.min(averageMonthsA || 0, averageMonthsB || 0))).toFixed(1)}x faster` : "faster"} with ${higherRiskCareerLabel === fasterCareerLabel ? "higher" : "lower"} risk profile, while ${fasterCareerLabel === compareDomainNameA ? compareDomainNameB : compareDomainNameA} may have a longer path but can suit long-term specialization goals.`
    : "Run comparison to get recommendation insight.";
  const avgRiskPercent = activeTimeline.length > 0
    ? (activeTimeline.reduce((sum, item) => sum + (item?.risk || 0), 0) / activeTimeline.length) * 100
    : 0;
  const fallbackBottleneck = activeTimeline.reduce((max, item) => {
    if (!max || (item?.months || 0) > (max?.months || 0)) return item;
    return max;
  }, null);
  const explanationList = useMemo(() => {
    const dynamicReasons = generateDynamicReasons(hours, learning, financial, data);
    const backendExplanations = Array.isArray(data?.explanations) ? data.explanations : [];
    return [...dynamicReasons, ...backendExplanations];
  }, [hours, learning, financial, data]);
  const scores = {
    risk_score: Number.isFinite(data?.scores?.risk_score) ? data.scores.risk_score : 0,
    effort_score: Number.isFinite(data?.scores?.effort_score) ? data.scores.effort_score : 0,
    stability_score: Number.isFinite(data?.scores?.stability_score) ? data.scores.stability_score : 0,
  };
  const analytics = {
    success_probability: Number.isFinite(data?.analytics?.success_probability)
      ? data.analytics.success_probability
      : 0,
    bottleneck_stage: typeof data?.analytics?.bottleneck_stage === "string"
      ? data.analytics.bottleneck_stage
      : "-",
    bottleneck_avg_months: Number.isFinite(data?.analytics?.bottleneck_avg_months)
      ? data.analytics.bottleneck_avg_months
      : 0,
  };

  const playTransitionTick = () => {
    try {
      if (typeof window === "undefined") return;
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioContextRef.current = new AudioContextClass();
      }

      const context = audioContextRef.current;
      if (context.state === "suspended") {
        context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 520;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const now = context.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      oscillator.start(now);
      oscillator.stop(now + 0.13);
    } catch {
      // Ignore audio errors to avoid interrupting visual playback.
    }
  };

  useEffect(() => {
    if (!hasSimulationData) {
      setJourneyRouteIds((prev) => (prev.length ? [] : prev));
      setJourneyStepIndex((prev) => (prev !== 0 ? 0 : prev));
      setSelectedJourneyNodeId((prev) => (prev ? null : prev));
      setDecisionMoment((prev) => (prev ? null : prev));
      setActiveEdgeId((prev) => (prev ? null : prev));
      setVisitedEdgeIds((prev) => (prev.length ? [] : prev));
      setRouteMonthMarks((prev) => (prev.length ? [] : prev));
      setJourneyMonth((prev) => (prev !== 0 ? 0 : prev));
      setIsAutoAnimating(false);
      return;
    }

    playbackTokenRef.current += 1;
    const token = playbackTokenRef.current;
    const baseRoute = ["start", ...journeyGraph.stageNodeIds];
    const successRoll = Math.random() < branchProbabilities.success;

    const nextRouteIds = successRoll
      ? [...baseRoute, "outcome_success"]
      : [
          ...baseRoute,
          "outcome_failure",
          Math.random() < branchProbabilities.retry ? "outcome_retry" : "outcome_burnout"
        ];

    const nextMonthMarks = [];
    let monthCursor = 0;
    nextRouteIds.forEach((nodeId) => {
      if (nodeId.startsWith("stage_")) {
        const index = Number(nodeId.replace("stage_", ""));
        monthCursor += Number(activeTimeline[index]?.months || 0);
      } else if (nodeId === "outcome_retry") {
        monthCursor += 2;
      } else if (nodeId === "outcome_burnout") {
        monthCursor += 1;
      }

      nextMonthMarks.push(Number(monthCursor.toFixed(1)));
    });

    const improvementReasons = [
      learning === "fast"
        ? "Fast learning speed accelerates skill absorption and reduces delays."
        : learning === "medium"
          ? "Medium learning speed keeps progress consistent across stages."
          : "Slow learning speed adds delay pressure at decision-heavy stages.",
      financial === "low"
        ? "Low financial pressure reduces dropout risk during setbacks."
        : financial === "medium"
          ? "Medium financial pressure is manageable but still affects retry stress."
          : "High financial pressure increases burnout and failed-attempt exposure.",
      hours >= 4
        ? `${hours} hrs/day provides strong preparation momentum.`
        : `${hours} hrs/day is enough for progress but leaves less buffer for failure recovery.`
    ];

    setRunReasons(improvementReasons);
    setJourneyRouteIds(nextRouteIds);
    setRouteMonthMarks(nextMonthMarks);
    setJourneyStepIndex(0);
    setJourneyMonth(0);
    setSelectedJourneyNodeId(nextRouteIds[0]);
    setManualTimelineMode(false);
    setDecisionMoment(null);
    setVisitedEdgeIds([]);
    setActiveEdgeId(null);
    setIsAutoAnimating(true);

    const runTraversal = async () => {
      const attemptNodeId = journeyGraph.attemptNodeId;

      for (let index = 0; index < nextRouteIds.length; index += 1) {
        if (playbackTokenRef.current !== token || manualTimelineMode) return;

        const currentNodeId = nextRouteIds[index];
        const previousNodeId = nextRouteIds[index - 1];
        const edgeId = previousNodeId ? edgeLookupMap.get(`${previousNodeId}->${currentNodeId}`) : null;

        if (edgeId) {
          setActiveEdgeId(edgeId);
          setVisitedEdgeIds((prev) => {
            if (prev.includes(edgeId)) return prev;
            return [...prev, edgeId];
          });
          playTransitionTick();
        }

        setJourneyStepIndex(index);
        setSelectedJourneyNodeId(currentNodeId);
        setJourneyMonth(nextMonthMarks[index] || 0);

        if (currentNodeId === attemptNodeId) {
          setDecisionMoment({
            visible: true,
            success: Math.round(branchProbabilities.success * 100),
            failure: Math.round(branchProbabilities.failure * 100),
            chosen: null
          });
          await wait(900);
          if (playbackTokenRef.current !== token || manualTimelineMode) return;
          setDecisionMoment((prev) => prev ? { ...prev, chosen: successRoll ? "success" : "failure" } : prev);
          await wait(650);
          if (playbackTokenRef.current !== token || manualTimelineMode) return;
          setDecisionMoment((prev) => prev ? { ...prev, visible: false } : prev);
        }

        await wait(index === 0 ? 420 : 640);
      }

      setActiveEdgeId(null);
      setIsAutoAnimating(false);
    };

    runTraversal();

    return () => {
      playbackTokenRef.current += 1;
      setIsAutoAnimating(false);
    };
  }, [
    activeCase,
    hasSimulationData,
    data,
    hours,
    learning,
    financial,
    journeyGraph.stageNodeIds,
    journeyGraph.attemptNodeId,
    edgeLookupMap,
    playbackSeed,
    branchProbabilities.success,
    branchProbabilities.failure,
    branchProbabilities.retry,
    manualTimelineMode
  ]);

  useEffect(() => {
    if (!manualTimelineMode || journeyRouteIds.length === 0 || routeMonthMarks.length === 0) return;

    let nearestIndex = 0;
    for (let idx = 0; idx < routeMonthMarks.length; idx += 1) {
      if (journeyMonth >= routeMonthMarks[idx]) {
        nearestIndex = idx;
      }
    }

    setJourneyStepIndex(nearestIndex);
    setSelectedJourneyNodeId(journeyRouteIds[nearestIndex]);

    const nextVisitedEdges = [];
    for (let idx = 1; idx <= nearestIndex; idx += 1) {
      const edgeId = edgeLookupMap.get(`${journeyRouteIds[idx - 1]}->${journeyRouteIds[idx]}`);
      if (edgeId) nextVisitedEdges.push(edgeId);
    }

    setVisitedEdgeIds(nextVisitedEdges);
    setActiveEdgeId(null);
  }, [manualTimelineMode, journeyMonth, journeyRouteIds, routeMonthMarks, edgeLookupMap]);

  useEffect(() => {
    if (!autoRunOnLoad || autoRunTriggeredRef.current) return;
    autoRunTriggeredRef.current = true;
    runSimulation();
  }, [autoRunOnLoad]);

  useEffect(() => {
    if (!selectedJourneyNodeId) return;
    if (!journeyGraph.nodeMap[selectedJourneyNodeId]) {
      setSelectedJourneyNodeId(null);
    }
  }, [journeyGraph.nodeMap, selectedJourneyNodeId]);

  const labelFor = (key) => {
    const found = domainOptions.find((d) => d.key === key);
    return found?.name || DOMAIN_LABELS[key] || key;
  };

  const toggleJourneyFullscreen = async () => {
    setIsJourneyFullscreen((prev) => !prev);
  };

  const simulationLoading = loadingAction === "simulation";
  const comparisonLoading = loadingAction === "comparison";

  const renderLoadingLabel = (label) => (
    <div className="loading-inline" role="status" aria-live="polite">
      <span className="loading-spinner" />
      <span>{label}</span>
      <span className="loading-dots">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </div>
  );

  const renderWarmupSpinner = () => (
    <div className="loading-inline" role="status" aria-live="polite">
      <span className="loading-spinner" />
      <span>Waking up server</span>
      <span className="loading-dots">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </div>
  );

  const statusSync = liveStatusCheckedAt
    ? liveStatusCheckedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const isEngineRunning = Boolean(loadingAction || liveStatus.simulation_engine === "running");
  const engineLabel = isEngineRunning
    ? "Running"
    : (liveStatus.simulation_engine === "starting" ? "Starting" : "Offline");
  const modeLabel = loadingAction
    ? "Processing"
    : (liveStatus.status === "live" ? "Live" : "Standby");
  const routeOutcome = hasSimulationData
    ? (journeyRouteIds.includes("outcome_success") ? "SUCCESS" : (journeyRouteIds.includes("outcome_failure") ? "RECOVERY PATH" : "RUNNING"))
    : "WAITING";
  const riskBand = avgRiskPercent >= 65 ? "High" : (avgRiskPercent >= 35 ? "Medium" : "Low");
  const stabilityBand = scores.stability_score >= 70 ? "High" : (scores.stability_score >= 40 ? "Medium" : "Low");
  const quickSuccess = Number(((failurePathsAnalysis?.success || 0) * 100).toFixed(1));
  const quickRetry = Number(((failurePathsAnalysis?.failThenRetry || 0) * 100).toFixed(1));
  const quickBurnout = Number(((failurePathsAnalysis?.failThenBurnout || 0) * 100).toFixed(1));

  /* ---------------- UI ---------------- */

  return (
    <div className="app-container premium-shell">
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      {/* ---------------- SIDEBAR ---------------- */}
      <div className="sidebar">
        <h2>Career Simulator</h2>

        <div className={`backend-status ${backendStatus}`}>
          <span className="status-dot" />
          <span>
            {backendStatus === "online" && "Backend Online"}
            {backendStatus === "loading" && "Backend Loading"}
            {backendStatus === "offline" && "Backend Offline"}
          </span>
        </div>

        {["simulation", "comparison", "analytics"].map((v) => (
          <motion.div
            key={v}
            className={`sidebar-item ${activeView === v ? "active" : ""}`}
            onClick={() => setActiveView(v)}
            animate={{ x: activeView === v ? 8 : 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </motion.div>
        ))}
      </div>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <div className="main-content">
        <motion.div
          className="dashboard-hero"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="hero-copy">
            <h1>Simulation Center</h1>
            <p>Modern career simulation dashboard with explainable outcomes.</p>
          </div>
          <div className="hero-right status-strip">
            <span className={`status-pill ${isEngineRunning ? "ok" : "off"}`}>
              {isEngineRunning ? "🟢" : "🔴"} Engine: {engineLabel}
            </span>
            <span className="status-pill">⏱ Last Sync: {statusSync}</span>
            <span className="status-pill">📊 Mode: {modeLabel}</span>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ================= SIMULATION ================= */}
          {activeView === "simulation" && (
            <motion.div
              key="simulation-view"
              variants={pageMotion}
              initial="initial"
              animate="animate"
              exit="exit"
              className="view-panel"
            >
            <div className="simulation-top-grid">
            <motion.div
              className="card simulation-input-card"
              variants={cardMotion}
              initial="initial"
              animate="animate"
              whileHover={{ scale: 1.01 }}
            >
              <h3>Career Simulation</h3>

              <label>Career Domain</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="">Select your target domain</option>
                {domainOptions.map((d) => (
                  <option key={d.key} value={d.key}>{d.name}</option>
                ))}
              </select>
              <p className="status-text">Select the field you want to build your career in.</p>

              <label>Hours per Day</label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value === "" ? "" : +e.target.value)}
                min={MIN_HOURS_PER_DAY}
                max={MAX_HOURS_PER_DAY}
                placeholder="Enter daily study/work hours (1-16)"
              />
              <p className="status-text">Enter how many focused hours you can consistently spend each day.</p>

              <label>Learning Speed</label>
              <select value={learning} onChange={(e) => setLearning(e.target.value)}>
                <option value="">Select your learning pace</option>
                <option value="slow">Slow</option>
                <option value="medium">Medium</option>
                <option value="fast">Fast</option>
              </select>
              <p className="status-text">Choose the pace that best matches how quickly you learn new skills.</p>

              <label>Financial Pressure</label>
              <select value={financial} onChange={(e) => setFinancial(e.target.value)}>
                <option value="">Select financial pressure level</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="status-text">Pick how urgent your financial needs are while pursuing this path.</p>

              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={autoRunOnLoad}
                  onChange={(e) => setAutoRunOnLoad(e.target.checked)}
                />
                Auto-run simulation on load
              </label>

              <MotionButton className="run-btn" onClick={runSimulation} disabled={simulationLoading || comparisonLoading}>
                {simulationLoading ? "Simulating..." : "Run Simulation"}
              </MotionButton>

              {domainLoadError && (
                <p className="status-text">{domainLoadError}</p>
              )}

              {simulationError && (
                <div className="status-text error-block">
                  <p className="status-text error">{simulationError}</p>
                  <MotionButton className="retry-btn" onClick={runSimulation}>
                    Retry Simulation
                  </MotionButton>
                </div>
              )}

              {simulationLoading && (
                <div className="status-text">
                  {isWarmingUp ? renderWarmupSpinner() : renderLoadingLabel("Simulating")}
                </div>
              )}
            </motion.div>

            <motion.div
              className="simulation-insights-stack"
              variants={cardMotion}
              initial="initial"
              animate="animate"
            >
              <motion.div className="card compact-card" whileHover={{ y: -4 }}>
                <h3>Simulation Summary</h3>
                <div className="summary-list">
                  <p><strong>🎯 Outcome:</strong> {routeOutcome}</p>
                  <p><strong>⏱ Duration:</strong> {hasSimulationData ? `${Number(activeCaseMonths || 0).toFixed(1)} months` : "-"}</p>
                  <p><strong>⚠ Risk:</strong> {hasSimulationData ? riskBand : "-"}</p>
                  <p><strong>📊 Stability:</strong> {hasSimulationData ? stabilityBand : "-"}</p>
                </div>
              </motion.div>

              <motion.div className="card compact-card" whileHover={{ y: -4 }}>
                <h3>Quick Stats</h3>
                <div className="quick-stat-line">
                  <span>✔ Success</span>
                  <strong>{hasSimulationData ? `${quickSuccess}%` : "-"}</strong>
                </div>
                <div className="quick-stat-bar">
                  <motion.div
                    className="quick-stat-fill success"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, quickSuccess))}%` }}
                    transition={{ duration: 0.75, ease: "easeOut" }}
                  />
                </div>

                <div className="quick-stat-line">
                  <span>🔁 Retry</span>
                  <strong>{hasSimulationData ? `${quickRetry}%` : "-"}</strong>
                </div>
                <div className="quick-stat-bar">
                  <motion.div
                    className="quick-stat-fill retry"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, quickRetry))}%` }}
                    transition={{ duration: 0.85, ease: "easeOut" }}
                  />
                </div>

                <div className="quick-stat-line">
                  <span>🔥 Burnout</span>
                  <strong>{hasSimulationData ? `${quickBurnout}%` : "-"}</strong>
                </div>
                <div className="quick-stat-bar">
                  <motion.div
                    className="quick-stat-fill burnout"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, quickBurnout))}%` }}
                    transition={{ duration: 0.95, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            </motion.div>
            </div>

            {hasSimulationData && (
              <motion.div
                className="card"
                variants={cardMotion}
                initial="initial"
                animate="animate"
                whileHover={{ scale: 1.01 }}
              >
                  <div className="journey-heading-row">
                    <div>
                      <h3>{labelFor(domain)} Journey</h3>
                      <p className="journey-subtitle">Animated career path with state nodes and transition flow.</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <MotionButton
                        className="retry-btn journey-fullscreen-btn"
                        onClick={toggleJourneyFullscreen}
                      >
                        {isJourneyFullscreen ? "Exit Full Screen" : "Full Screen Output"}
                      </MotionButton>
                      {CASE_KEYS.map((k) => (
                        <MotionButton
                          key={k}
                          className={activeCase === k ? "active-tab" : ""}
                          onClick={() => setActiveCase(k)}
                        >
                          {k.replace("_", " ").toUpperCase()}
                        </MotionButton>
                      ))}
                    </div>
                  </div>

                  <div className="journey-rail-card">
                    <div className="journey-rail-topline">
                      <span>Beginner</span>
                      <span>Learning</span>
                      <span>Attempt</span>
                      <span>Outcome</span>
                    </div>

                    <div className="journey-flow-layout">
                      <div className="journey-flow-scroll">
                        <div
                          ref={journeyFlowWrapRef}
                          className="journey-flow-wrap"
                          style={{
                            width: journeyWidth,
                            minWidth: journeyWidth,
                            height: journeyHeight
                          }}
                        >
                          <svg className="journey-ghost-overlay" viewBox={`0 0 ${journeyWidth} ${journeyHeight}`} preserveAspectRatio="none" aria-hidden="true">
                            {journeyGhostRoutes.map((route) => (
                              <polyline
                                key={route.id}
                                points={route.points}
                                className={`journey-ghost-line ${route.success ? "success" : "failure"}`}
                                style={{ opacity: route.opacity }}
                              />
                            ))}
                          </svg>

                          <ReactFlow
                            key={`rf_${activeCase}_${isJourneyFullscreen ? "fs" : "std"}`}
                            nodes={displayedJourneyNodes}
                            edges={displayedJourneyEdges}
                            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                            fitView
                            fitViewOptions={{
                              padding: isJourneyFullscreen ? 0.12 : 0.2,
                              minZoom: isJourneyFullscreen ? 0.45 : 0.55,
                              maxZoom: 1.3
                            }}
                            nodesDraggable={false}
                            nodesConnectable={false}
                            elementsSelectable
                            zoomOnScroll={false}
                            panOnDrag={false}
                            minZoom={0.55}
                            maxZoom={1.3}
                            onNodeClick={(_, node) => setSelectedJourneyNodeId(node.id)}
                          >
                            <Background gap={18} size={1.2} color="rgba(37,99,235,0.15)" />
                            <Controls showInteractive={false} position="bottom-right" />
                          </ReactFlow>

                          {decisionMoment?.visible && (
                            <motion.div
                              className="journey-decision-pop"
                              initial={{ opacity: 0, y: 8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.25 }}
                            >
                              <h5>Attempt Result</h5>
                              <p className="success">Success ({decisionMoment.success}%)</p>
                              <p className="fail">Failure ({decisionMoment.failure}%)</p>
                              {decisionMoment.chosen && (
                                <p className="chosen">Chosen Path: {decisionMoment.chosen === "success" ? "Success" : "Failure"}</p>
                              )}
                            </motion.div>
                          )}

                          {journeyMarkerPosition && (
                            <motion.div
                              className={`journey-flow-marker ${isAutoAnimating ? "moving" : ""}`}
                              initial={{ x: journeyMarkerPosition.x, y: journeyMarkerPosition.y, opacity: 0 }}
                              animate={{ x: journeyMarkerPosition.x, y: journeyMarkerPosition.y, opacity: 1 }}
                              transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <span />
                            </motion.div>
                          )}
                        </div>
                      </div>

                      <div className="journey-detail-card">
                        {selectedJourneyNode ? (
                          <>
                            <h4>{selectedJourneyNode?.data?.detail?.title || "Journey Node"}</h4>
                            <p className="journey-detail-type">{selectedJourneyNode?.data?.detail?.type || "State"}</p>
                            <p><strong>Duration:</strong> {(selectedJourneyNode?.data?.detail?.months || 0).toFixed(1)} months</p>
                            <p><strong>Risk:</strong> {selectedJourneyNode?.data?.detail?.risk || 0}%</p>
                            <p className="journey-detail-note">{selectedJourneyNode?.data?.detail?.note || "No details available."}</p>
                          </>
                        ) : (
                          <p className="status-text">Click any node to inspect stage details, risk, and action notes.</p>
                        )}

                        {runReasons.length > 0 && (
                          <div className="journey-reason-block">
                            <h5>Why This Path Was Chosen</h5>
                            <ul>
                              {runReasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="journey-slider-wrap">
                      <div className="journey-slider-head">
                        <span>Timeline Progress</span>
                        <strong>Month {journeyMonth.toFixed(1)} / {timelineSliderMax.toFixed(1)}</strong>
                      </div>
                      <input
                        className="journey-slider"
                        type="range"
                        min={0}
                        max={timelineSliderMax}
                        step={0.1}
                        value={Math.max(0, Math.min(timelineSliderMax, journeyMonth))}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setManualTimelineMode(true);
                          setJourneyMonth(value);
                          setDecisionMoment(null);
                        }}
                      />
                      <MotionButton
                        className="retry-btn"
                        onClick={() => {
                          setManualTimelineMode(false);
                          setDecisionMoment(null);
                          setPlaybackSeed((seed) => seed + 1);
                        }}
                      >
                        Replay Auto Journey
                      </MotionButton>
                    </div>

                    <div className="journey-caption">
                      <strong>
                        Active Route: {journeyRouteIds[journeyStepIndex] ? journeyRouteIds[journeyStepIndex].replace("outcome_", "").replace("stage_", "Stage ") : "Waiting"}
                      </strong>
                      <span>
                        Success {(branchProbabilities.success * 100).toFixed(0)}% | Failure {(branchProbabilities.failure * 100).toFixed(0)}% | Retry {(branchProbabilities.retry * 100).toFixed(0)}% | {manualTimelineMode ? "Manual Timeline" : "Auto Timeline"}
                      </span>
                    </div>
                  </div>

                  {activeTimeline.length === 0 && (
                    <p className="status-text">No timeline entries available for this case.</p>
                  )}

                  {/* EXPORT/SHARE & ALT PATH */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <MotionButton
                      className="retry-btn"
                      onClick={exportToPDF}
                      style={{ flex: 1, minWidth: '120px' }}
                    >
                      📄 Export PDF
                    </MotionButton>
                    <MotionButton
                      className="retry-btn"
                      onClick={generateShareLink}
                      style={{ flex: 1, minWidth: '120px' }}
                    >
                      🔗 Share Link
                    </MotionButton>
                    <div style={{ flex: 1, minWidth: '180px', display: 'flex', gap: '8px' }}>
                      <select
                        value={altPathDomain ?? ""}
                        onChange={(e) => setAltPathDomain(e.target.value || null)}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                      >
                        <option value="">Try Alternate Path</option>
                        {domainOptions
                          .filter((d) => d.key !== domain)
                          .map((d) => (
                            <option key={d.key} value={d.key}>{d.name}</option>
                          ))}
                      </select>
                      {altPathDomain && (
                        <MotionButton
                          className="run-btn"
                          onClick={simulateAlternativePath}
                          style={{ padding: '8px 16px' }}
                        >
                          🎯 Switch
                        </MotionButton>
                      )}
                    </div>
                  </div>
                  {shareMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: '10px',
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: shareMessage.includes('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: shareMessage.includes('✅') ? '#22c55e' : '#ef4444',
                        fontSize: '0.85rem',
                        textAlign: 'center'
                      }}
                    >
                      {shareMessage}
                    </motion.div>
                  )}

                <h4 style={{ marginTop: 18 }}>Explainable Insights</h4>
                {explanationList.length > 0 ? (
                  <ul className="explanation-list">
                    {explanationList.map((item, idx) => (
                      <li key={`${idx}_${item.slice(0, 12)}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="status-text">No explanations available.</p>
                )}

                <h4 style={{ marginTop: 18 }}>🔀 Failure Paths Scenarios</h4>
                {failurePathsAnalysis ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "12px",
                      marginBottom: "18px"
                    }}
                  >
                    <div style={{ padding: "12px", backgroundColor: "rgba(34, 197, 94, 0.1)", borderRadius: "6px", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "4px" }}>Success Path</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#22c55e" }}>
                        {(failurePathsAnalysis.success * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "0.7rem", marginTop: "4px", color: "#666" }}>Reach goal successfully</div>
                    </div>

                    <div style={{ padding: "12px", backgroundColor: "rgba(245, 158, 11, 0.1)", borderRadius: "6px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "4px" }}>Retry Loop</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#f59e0b" }}>
                        {(failurePathsAnalysis.failThenRetry * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "0.7rem", marginTop: "4px", color: "#666" }}>Fail then prepare & retry</div>
                    </div>

                    <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "4px" }}>Burnout Risk</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#ef4444" }}>
                        {(failurePathsAnalysis.failThenBurnout * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "0.7rem", marginTop: "4px", color: "#666" }}>Fail, stress, exit/delay</div>
                    </div>

                    <div style={{ padding: "12px", backgroundColor: "rgba(59, 130, 246, 0.1)", borderRadius: "6px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "4px" }}>Avg Retries</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#3b82f6" }}>
                        {failurePathsAnalysis.avgRetries}
                      </div>
                      <div style={{ fontSize: "0.7rem", marginTop: "4px", color: "#666" }}>Expected attempts</div>
                    </div>
                  </div>
                ) : (
                  <p className="status-text">Run simulation to see failure path analysis.</p>
                )}

                <h4 style={{ marginTop: 18 }}>Score System</h4>
                <div className="score-grid">
                  <div className="score-card">
                    <span>Risk Score</span>
                    <strong>{scores.risk_score}</strong>
                  </div>
                  <div className="score-card">
                    <span>Effort Score</span>
                    <strong>{scores.effort_score}</strong>
                  </div>
                  <div className="score-card">
                    <span>Stability Score</span>
                    <strong>{scores.stability_score}</strong>
                  </div>
                </div>

                <h4 style={{ marginTop: 18 }}>Quick Insights</h4>
                <div className="analytics-insights-grid">
                  <div className="insight-card">
                    <p className="insight-title">Total Duration</p>
                    <p className="insight-value">{Number(activeCaseMonths || 0).toFixed(2)} months</p>
                  </div>
                  <div className="insight-card">
                    <p className="insight-title">Average Risk</p>
                    <p className="insight-value">{avgRiskPercent.toFixed(1)}%</p>
                  </div>
                  <div className="insight-card">
                    <p className="insight-title">Bottleneck Stage</p>
                    <p className="insight-value">{analytics.bottleneck_stage !== "-" ? analytics.bottleneck_stage : (fallbackBottleneck?.stage || "-")}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {!simulationLoading && !hasSimulationData && !simulationError && (
              <motion.div
                className="card"
                variants={cardMotion}
                initial="initial"
                animate="animate"
                whileHover={{ scale: 1.01 }}
              >
                <p className="status-text">Run simulation to view timeline and analytics.</p>
              </motion.div>
            )}

            {simulationLoading && !hasSimulationData && (
              <motion.div
                className="card skeleton-card"
                variants={cardMotion}
                initial="initial"
                animate="animate"
              >
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
              </motion.div>
            )}
            </motion.div>
          )}

          {/* ================= COMPARISON ================= */}
          {activeView === "comparison" && (
            <motion.div
              key="comparison-view"
              variants={pageMotion}
              initial="initial"
              animate="animate"
              exit="exit"
              className="view-panel"
            >
            <motion.div
              className="card compare-grid"
              variants={cardMotion}
              initial="initial"
              animate="animate"
              whileHover={{ scale: 1.01 }}
            >
              {[compareA, compareB].map((c, idx) => (
                <div key={idx} className="compare-column">
                  <h4>Career {idx === 0 ? "A" : "B"}</h4>

                  <label>Career Domain</label>

                  <select
                    value={c.domain}
                    onChange={(e) =>
                      idx === 0
                        ? setCompareA({ ...c, domain: e.target.value })
                        : setCompareB({ ...c, domain: e.target.value })
                    }
                  >
                    {domainOptions.map((d) => (
                      <option key={d.key} value={d.key}>{d.name}</option>
                    ))}
                  </select>

                  <label>Hours per Day</label>
                  <input
                    type="number"
                    value={c.hours}
                    onChange={(e) =>
                      idx === 0
                        ? setCompareA({ ...c, hours: +e.target.value })
                        : setCompareB({ ...c, hours: +e.target.value })
                    }
                    min={MIN_HOURS_PER_DAY}
                    max={MAX_HOURS_PER_DAY}
                  />

                  <label>Learning Speed</label>

                  <select
                    value={c.learning}
                    onChange={(e) =>
                      idx === 0
                        ? setCompareA({ ...c, learning: e.target.value })
                        : setCompareB({ ...c, learning: e.target.value })
                    }
                  >
                    <option value="slow">Slow</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast</option>
                  </select>

                  <label>Financial Pressure</label>

                  <select
                    value={c.financial}
                    onChange={(e) =>
                      idx === 0
                        ? setCompareA({ ...c, financial: e.target.value })
                        : setCompareB({ ...c, financial: e.target.value })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              ))}
            </motion.div>

            <MotionButton className="run-btn" onClick={runComparison} disabled={simulationLoading || comparisonLoading}>
              {comparisonLoading ? "Comparing..." : "Compare"}
            </MotionButton>

            {comparisonError && (
              <div className="status-text error-block">
                <p className="status-text error">{comparisonError}</p>
                <MotionButton className="retry-btn" onClick={runComparison}>
                  Retry Comparison
                </MotionButton>
              </div>
            )}

            {comparisonLoading && (
              <p className="status-text">
                {isWarmingUp ? renderWarmupSpinner() : renderLoadingLabel("Comparing")}
              </p>
            )}

            {hasComparisonData && (
              <>
                <motion.div
                  className="card"
                  variants={cardMotion}
                  initial="initial"
                  animate="animate"
                  whileHover={{ scale: 1.01 }}
                >
                  <h4>Visual Comparison Chart</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={comparisonChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="scenario" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(1)} months`} />
                      <Legend />
                      <Bar dataKey="a" name={compareDomainNameA} fill="#2563eb" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="b" name={compareDomainNameB} fill="#9333ea" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                <motion.div
                  className="card comparison-winner-row"
                  variants={cardMotion}
                  initial="initial"
                  animate="animate"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="winner-pill">🏆 Faster Career: <strong>{fasterCareerLabel}</strong></div>
                  <div className="winner-pill">⚠ Higher Risk: <strong>{higherRiskCareerLabel}</strong></div>
                  <div className="winner-pill">📈 Stable Path: <strong>{stableCareerLabel}</strong></div>
                </motion.div>

                <motion.div
                  className="card compare-score-grid"
                  variants={cardMotion}
                  initial="initial"
                  animate="animate"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="compare-score-card">
                    <h4>{compareDomainNameA}</h4>
                    <p>⏱ Avg Time: <strong>{Number(averageMonthsA || 0).toFixed(1)} months</strong></p>
                    <p>⚠ Risk: <strong>{compareRiskLabelA}</strong></p>
                    <p>📊 Stability: <strong>{compareStabilityLabelA}</strong></p>
                    <p className="mini-timeline">{miniTimelineA || "No timeline"}</p>
                  </div>
                  <div className="compare-score-card">
                    <h4>{compareDomainNameB}</h4>
                    <p>⏱ Avg Time: <strong>{Number(averageMonthsB || 0).toFixed(1)} months</strong></p>
                    <p>⚠ Risk: <strong>{compareRiskLabelB}</strong></p>
                    <p>📊 Stability: <strong>{compareStabilityLabelB}</strong></p>
                    <p className="mini-timeline">{miniTimelineB || "No timeline"}</p>
                  </div>
                </motion.div>

                <motion.div
                  className="card comparison-summary"
                  variants={cardMotion}
                  initial="initial"
                  animate="animate"
                  whileHover={{ scale: 1.01 }}
                >
                  <h4>Final Recommendation Insight</h4>
                  <p>{recommendationSummary}</p>
                  {comparisonDelta !== null && (
                    <p style={{ marginTop: 6 }}>
                      Timeline Difference: <strong>{comparisonDelta.toFixed(2)} months</strong>
                    </p>
                  )}
                </motion.div>
              </>
            )}
            </motion.div>
          )}

          {/* ================= ANALYTICS ================= */}
          {activeView === "analytics" && (
            hasSimulationData ? (
            <motion.div
              key="analytics-view"
              className="card"
              variants={pageMotion}
              initial="initial"
              animate="animate"
              exit="exit"
              whileHover={{ scale: 1.01 }}
            >
              <h3>Analytics</h3>
              <div style={{ padding: "12px", backgroundColor: "rgba(59, 130, 246, 0.08)", borderRadius: "8px", marginBottom: "20px", borderLeft: "4px solid #2563eb" }}>
                <p style={{ margin: 0, fontSize: "0.95rem", color: "#475569" }}>📊 Domain: <strong>{DOMAIN_LABELS[domain] || domain}</strong></p>
              </div>

              <h4>Scenario Comparison (Months)</h4>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 12px 0" }}>Compares the total duration across best-case, average-case, and worst-case scenarios. Shows how different outcomes affect the timeline for your career goal.</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={scenarioComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scenario" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="months" fill="#2563eb" isAnimationActive animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>

              <h4 style={{ marginTop: 30 }}>Stage-wise Time Distribution</h4>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 12px 0" }}>Breaks down the time spent in each stage of your career journey. Identifies which stages consume the most time and where you may need additional focus.</p>
              {hasBestCaseTimeline ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stageAnalyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="months" fill="#2563eb" isAnimationActive animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="status-text">No stage timeline available in best-case scenario.</p>
              )}

              <h4 style={{ marginTop: 30 }}>Risk Exposure by Stage</h4>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 12px 0" }}>Visualizes the potential risk factors at each stage. Higher risk values indicate stages that pose greater challenges and require more careful planning and preparation.</p>
              {hasBestCaseTimeline ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stageAnalyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Bar dataKey="risk" fill="#ef4444" isAnimationActive animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="status-text">No risk timeline available in best-case scenario.</p>
              )}

              <h4 style={{ marginTop: 30 }}>📈 Timeline Progression (Cumulative)</h4>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 12px 0" }}>Shows the cumulative progression of time through each stage. The upward trend illustrates how your journey compounds over time as you advance through stages.</p>
              {timelineProgressionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineProgressionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cumulativeMonths"
                      stroke="#3b82f6"
                      isAnimationActive
                      animationDuration={900}
                      name="Cumulative Months"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="status-text">No progression data available.</p>
              )}

              <h4 style={{ marginTop: 30 }}>🎯 Probability Distribution (Path Outcomes)</h4>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 12px 0" }}>Displays the probability of different career outcomes: Success (reaching your goal), Retry Path (failing and trying again), and Burnout Risk (leaving the field). Helps you understand the likelihood of each scenario.</p>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={probabilityDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive
                    animationDuration={900}
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>

              <h4 style={{ marginTop: 30 }}>🔀 Failure Path Analysis (All Outcomes)</h4>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 12px 0" }}>In-depth analysis of failure scenarios and how they evolve. Shows the percentage of attempts that succeed versus those that lead to retries or burnout, with insights on average retry attempts and burnout risk levels.</p>
              {failurePathsPieData.length > 0 ? (
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "300px" }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={failurePathsPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}%`}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                          isAnimationActive
                          animationDuration={900}
                        >
                          {failurePathsPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, minWidth: "280px", padding: "12px", backgroundColor: "rgba(99, 102, 241, 0.05)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "0.9rem", margin: "0 0 12px 0", fontWeight: "600" }}>📊 Failure Path Breakdown</p>
                    <div style={{ fontSize: "0.85rem", lineHeight: "1.8" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ display: "inline-block", width: "12px", height: "12px", backgroundColor: "#22c55e", borderRadius: "2px" }} />
                        <span><strong>Success:</strong> {failurePathsAnalysis?.success.toFixed(1) || 0}% reach goal</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ display: "inline-block", width: "12px", height: "12px", backgroundColor: "#f59e0b", borderRadius: "2px" }} />
                        <span><strong>Retry:</strong> {failurePathsAnalysis?.failThenRetry.toFixed(1) || 0}% fail then retry</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <span style={{ display: "inline-block", width: "12px", height: "12px", backgroundColor: "#ef4444", borderRadius: "2px" }} />
                        <span><strong>Burnout/Exit:</strong> {failurePathsAnalysis?.failThenBurnout.toFixed(1) || 0}%</span>
                      </div>
                      <hr style={{ opacity: 0.3, margin: "10px 0" }} />
                      <div style={{ fontSize: "0.8rem", marginTop: "10px" }}>
                        <div>Avg retry attempts: <strong>{failurePathsAnalysis?.avgRetries || 0}</strong></div>
                        <div>Burnout risk: <strong>{failurePathsAnalysis?.burnoutRisk || 0}%</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="status-text">No failure path data available.</p>
              )}

              <h4 style={{ marginTop: 30 }}>Optional Insights</h4>
              <p style={{ fontSize: "0.9rem", color: "#64748b", margin: "0 0 12px 0" }}>Key metrics derived from your simulation: identifies bottleneck stages, overall success probability, risk exposure, effort required, and stability of your career path.</p>
              <div className="analytics-insights-grid">
                <div className="insight-card">
                  <p className="insight-title">Bottleneck Stage Detection</p>
                  <p className="insight-value">{analytics.bottleneck_stage}</p>
                  <p className="status-text">
                    Avg duration: {analytics.bottleneck_avg_months} months
                  </p>
                </div>

                <div className="insight-card">
                  <p className="insight-title">Success Probability</p>
                  <p className="insight-value">{analytics.success_probability}%</p>
                  <div className="probability-track">
                    <div
                      className="probability-fill"
                      style={{ width: `${Math.max(0, Math.min(100, analytics.success_probability))}%` }}
                    />
                  </div>
                </div>

                <div className="insight-card">
                  <p className="insight-title">Risk Score</p>
                  <p className="insight-value">{scores.risk_score}</p>
                </div>

                <div className="insight-card">
                  <p className="insight-title">Effort Score</p>
                  <p className="insight-value">{scores.effort_score}</p>
                </div>

                <div className="insight-card">
                  <p className="insight-title">Stability Score</p>
                  <p className="insight-value">{scores.stability_score}</p>
                </div>
              </div>
              </motion.div>
          ) : (
              <motion.div
                key="analytics-empty-view"
                className="card"
                variants={pageMotion}
                initial="initial"
                animate="animate"
                exit="exit"
              >
              <p className="status-text">Run simulation first to view analytics charts.</p>
              </motion.div>
          )
            )}
          </AnimatePresence>
      </div>

      {isJourneyFullscreen && createPortal(
        <>
          <div
            className="journey-flow-backdrop"
            onClick={() => setIsJourneyFullscreen(false)}
            aria-hidden="true"
          />
          <button
            type="button"
            className="journey-fullscreen-close-x"
            onClick={() => setIsJourneyFullscreen(false)}
            aria-label="Close fullscreen journey view"
          >
            X
          </button>
          <div className="journey-flow-wrap fullscreen">
            <svg className="journey-ghost-overlay" viewBox={`0 0 ${journeyWidth} ${journeyHeight}`} preserveAspectRatio="none" aria-hidden="true">
              {journeyGhostRoutes.map((route) => (
                <polyline
                  key={`fs_${route.id}`}
                  points={route.points}
                  className={`journey-ghost-line ${route.success ? "success" : "failure"}`}
                  style={{ opacity: route.opacity }}
                />
              ))}
            </svg>

            <ReactFlow
              key={`rf_portal_${activeCase}_${playbackSeed}`}
              nodes={displayedJourneyNodes}
              edges={displayedJourneyEdges}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              fitView
              fitViewOptions={{
                padding: 0.08,
                minZoom: 0.35,
                maxZoom: 1.35
              }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              zoomOnScroll
              panOnDrag
              minZoom={0.3}
              maxZoom={1.35}
              onNodeClick={(_, node) => setSelectedJourneyNodeId(node.id)}
            >
              <Background gap={18} size={1.2} color="rgba(37,99,235,0.15)" />
              <Controls showInteractive={false} position="bottom-right" />
            </ReactFlow>

            {journeyMarkerPosition && (
              <motion.div
                className={`journey-flow-marker ${isAutoAnimating ? "moving" : ""}`}
                initial={{ x: journeyMarkerPosition.x, y: journeyMarkerPosition.y, opacity: 0 }}
                animate={{ x: journeyMarkerPosition.x, y: journeyMarkerPosition.y, opacity: 1 }}
                transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
              >
                <span />
              </motion.div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export default Dashboard;