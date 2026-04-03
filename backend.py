from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core.user_profile import UserProfile
from data.careers import CAREER_REGISTRY
from simulation.simulator import CareerSimulator

app = FastAPI(title="Multi-Domain Career Simulation System")


LearningSpeed = Literal["slow", "medium", "fast"]
FinancialPressure = Literal["low", "medium", "high"]


class SimulationRequest(BaseModel):
    domain: str
    hours_per_day: int = Field(ge=1, le=16)
    learning_speed: LearningSpeed
    financial_pressure: FinancialPressure
    runs: int = Field(default=30, ge=5, le=500)


class DomainInfo(BaseModel):
    key: str
    name: str


class InputsPayload(BaseModel):
    hours_per_day: int
    learning_speed: LearningSpeed
    financial_pressure: FinancialPressure
    runs: int


class TimelineEntry(BaseModel):
    stage: str
    months: float
    risk: float
    status: str
    note: str | None = None


class ScenarioPayload(BaseModel):
    total_months: float
    failures: int
    timeline: list[TimelineEntry]


class ScenariosPayload(BaseModel):
    best_case: ScenarioPayload
    average_case: ScenarioPayload
    worst_case: ScenarioPayload


class ScoresPayload(BaseModel):
    risk_score: float
    effort_score: float
    stability_score: float


class AnalyticsPayload(BaseModel):
    success_probability: float
    retry_probability: float
    burnout_probability: float
    bottleneck_stage: str | None = None
    bottleneck_avg_months: float


class StatusPayload(BaseModel):
    ui_version: str
    status: Literal["live", "loading", "offline"]
    simulation_engine: Literal["running", "starting", "offline"]


class SimulationResponse(BaseModel):
    domain: str
    inputs: InputsPayload
    scenarios: ScenariosPayload
    explanations: list[str]
    scores: ScoresPayload
    analytics: AnalyticsPayload


def _clamp_score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def _build_explanations(payload: SimulationRequest, outcome: dict) -> list[str]:
    """
    Generate 5-7 context-aware explanations from simulation inputs and outcomes.
    
    Explanations cover:
    - Timeline spread (best vs worst variance)
    - Average risk exposure
    - Impact of learning speed
    - Impact of daily study hours
    - Impact of financial pressure
    - Failure frequency
    """
    average_case = outcome.get("average_case", {})
    best_case = outcome.get("best_case", {})
    worst_case = outcome.get("worst_case", {})
    timeline = average_case.get("timeline", []) if isinstance(average_case.get("timeline", []), list) else []

    avg_months = float(average_case.get("total_months", 0) or 0)
    best_months = float(best_case.get("total_months", 0) or 0)
    worst_months = float(worst_case.get("total_months", 0) or 0)
    failures = int(average_case.get("failures", 0) or 0)

    avg_risk = 0.0
    if timeline:
        avg_risk = sum(float(step.get("risk", 0) or 0) for step in timeline) / len(timeline)

    explanations = [
        f"Average outcome is {avg_months:.1f} months, with best-to-worst spread of {max(0, worst_months - best_months):.1f} months.",
        f"Estimated risk exposure is {min(avg_risk * 100, 100):.1f}% across average-case stages.",
    ]

    if payload.learning_speed == "slow":
        explanations.append("Learning speed is set to slow, which introduces additional delay in stage progression.")
    elif payload.learning_speed == "fast":
        explanations.append("Learning speed is fast, which reduces expected stage duration and improves timeline outcomes.")

    if payload.hours_per_day < 3:
        explanations.append("Low daily study hours can delay completion time and increase uncertainty in outcomes.")
    elif payload.hours_per_day >= 12:
        explanations.append("High daily study hours reduce time-to-completion and provide more stable, predictable outcomes.")

    if payload.financial_pressure == "high":
        explanations.append("High financial pressure increases failure likelihood, which can push paths toward exits or burnout.")
    elif payload.financial_pressure == "low":
        explanations.append("Low financial pressure provides buffer for recovery from setbacks and allows more deliberate pace.")

    if failures > 0:
        explanations.append(f"Average-case path includes {failures} failure event(s), indicating non-linear progression risk.")
    else:
        explanations.append("Average-case path shows no failures, indicating stable progression under current profile.")

    return explanations[:7]  # Cap at 7 explanations


def _build_scores(career, outcome: dict) -> dict:
    """
    Calculate three composite scores from simulation outcomes.
    
    - risk_score: How much risk is present (70% avg_risk + 12% per failure)
    - effort_score: How much effort required (10x avg_effort_level)
    - stability_score: How predictable/stable the path is (inverse of risk, failures, variance)
    
    All scores are clamped to [0, 100].
    """
    average_case = outcome.get("average_case", {})
    timeline = average_case.get("timeline", []) if isinstance(average_case.get("timeline", []), list) else []
    failures = float(average_case.get("failures", 0) or 0)
    best_months = float(outcome.get("best_case", {}).get("total_months", 0) or 0)
    worst_months = float(outcome.get("worst_case", {}).get("total_months", 0) or 0)

    # Compute average risk across all stages
    if timeline:
        avg_risk = sum(float(step.get("risk", 0) or 0) for step in timeline) / len(timeline)
    else:
        avg_risk = 0.0

    # Compute effort score by weighting stage effort by duration
    weighted_effort = 0.0
    months_sum = 0.0
    for step in timeline:
        stage_name = step.get("stage")
        months = float(step.get("months", 0) or 0)
        if stage_name and months > 0:
            state = career.get_state(stage_name) if hasattr(career, "get_state") else None
            effort = float(getattr(state, "effort_level", 0) or 0) if state else 0.0
            weighted_effort += effort * months
            months_sum += months

    avg_effort = (weighted_effort / months_sum) if months_sum > 0 else 0.0
    
    # Spread = uncertainty (best vs worst case gap)
    spread = max(0.0, worst_months - best_months)

    # Score formulas
    risk_score = _clamp_score((avg_risk * 70) + (failures * 12))
    effort_score = _clamp_score(avg_effort * 10)
    stability_score = _clamp_score(100 - ((avg_risk * 45) + (failures * 20) + min(spread * 1.4, 40)))

    return {
        "risk_score": risk_score,
        "effort_score": effort_score,
        "stability_score": stability_score,
    }

# -------------------------------
# CORS CONFIGURATION
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "Career Simulator API running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/status", response_model=StatusPayload)
def api_status():
    return {
        "ui_version": "v2",
        "status": "live",
        "simulation_engine": "running",
    }


@app.get("/domains", response_model=list[DomainInfo])
def list_domains():
    domains: list[DomainInfo] = []
    for key, factory in CAREER_REGISTRY.items():
        domains.append(DomainInfo(key=key, name=factory().name))
    return domains


@app.post("/simulate", response_model=SimulationResponse)
def simulate(payload: SimulationRequest):
    """
    Run multi-domain career path simulations with explainability and scoring.
    
    Args:
        payload: SimulationRequest with domain, hours_per_day (1-16), learning_speed,
                 financial_pressure, and runs count (5-500, default 30)
    
    Returns:
        SimulationResponse with best/avg/worst scenarios, explanations, scores, analytics
    
    Process:
        1. Validate domain exists in career registry
        2. Convert daily hours → weekly hours
        3. Create user profile from inputs
        4. Run M simulations (where M = payload.runs)
        5. Extract best/average/worst timelines
        6. Generate explanations and scores
        7. Return structured response with analytics
    
    Errors:
        400: Invalid domain or constraint violations
    """
    # Validate domain exists
    if payload.domain not in CAREER_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid domain",
                "available_domains": list(CAREER_REGISTRY.keys())
            }
        )

    # Convert hours per day → per week (7 days × daily hours)
    weekly_hours = payload.hours_per_day * 7

    # Create user profile with validated inputs
    user = UserProfile(
        education_level="Any",
        available_hours_per_week=weekly_hours,
        learning_speed=payload.learning_speed,
        financial_pressure=payload.financial_pressure,
        risk_tolerance="medium"
    )

    # Run simulations for selected domain
    career_factory = CAREER_REGISTRY[payload.domain]
    career = career_factory()

    simulator = CareerSimulator(career, user)
    internal_runs = max(50, int(payload.runs))
    try:
        outcome = simulator.run_multiple(runs=internal_runs)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Simulation failed due to internal error. Please retry."
        ) from exc
    
    # Generate insights from outcomes
    explanations = _build_explanations(payload, outcome)
    scores = _build_scores(career, outcome)

    # Return clean, typed response
    analytics = outcome.get("analytics", {}) if isinstance(outcome.get("analytics", {}), dict) else {}

    return {
        "domain": career.name,
        "inputs": {
            "hours_per_day": payload.hours_per_day,
            "learning_speed": payload.learning_speed,
            "financial_pressure": payload.financial_pressure,
            "runs": internal_runs
        },
        "scenarios": {
            "best_case": outcome["best_case"],
            "average_case": outcome["average_case"],
            "worst_case": outcome["worst_case"]
        },
        "explanations": explanations,
        "scores": scores,
        "analytics": {
            "success_probability": float(analytics.get("success_probability", 0.0) or 0.0),
            "retry_probability": float(analytics.get("retry_probability", 0.0) or 0.0),
            "burnout_probability": float(analytics.get("burnout_probability", 0.0) or 0.0),
            "bottleneck_stage": analytics.get("bottleneck_stage"),
            "bottleneck_avg_months": float(analytics.get("bottleneck_avg_months", 0.0) or 0.0),
        }
    }
