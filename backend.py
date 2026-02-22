from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.user_profile import UserProfile
from data.careers import CAREER_REGISTRY
from simulation.simulator import CareerSimulator

app = FastAPI(title="Multi-Domain Career Simulation System")

# -------------------------------
# CORS CONFIGURATION
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "Career Simulator API running"}


@app.post("/simulate")
def simulate(
    domain: str,
    hours_per_day: int,
    learning_speed: str,
    financial_pressure: str
):
    # -------------------------------
    # Validate domain
    # -------------------------------
    if domain not in CAREER_REGISTRY:
        return {
            "error": "Invalid domain",
            "available_domains": list(CAREER_REGISTRY.keys())
        }

    # -------------------------------
    # Convert hours per day → per week
    # -------------------------------
    weekly_hours = hours_per_day * 7

    # -------------------------------
    # Create user profile
    # -------------------------------
    user = UserProfile(
        education_level="Any",
        available_hours_per_week=weekly_hours,
        learning_speed=learning_speed,
        financial_pressure=financial_pressure,
        risk_tolerance="medium"
    )

    # -------------------------------
    # Run simulation for SELECTED domain
    # -------------------------------
    career_factory = CAREER_REGISTRY[domain]
    career = career_factory()

    simulator = CareerSimulator(career, user)
    outcome = simulator.run_multiple(runs=30)

    # -------------------------------
    # Clean, UI-friendly response
    # -------------------------------
    return {
        "domain": career.name,
        "inputs": {
            "hours_per_day": hours_per_day,
            "learning_speed": learning_speed,
            "financial_pressure": financial_pressure
        },
        "scenarios": {
            "best_case": outcome["best_case"],
            "average_case": outcome["average_case"],
            "worst_case": outcome["worst_case"]
        }
    }
