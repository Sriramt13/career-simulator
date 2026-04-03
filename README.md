# Multi-Domain Career Path Simulation & Outcome Forecasting System

A full-stack simulation platform that models career progression as probabilistic state transitions, then forecasts best/average/worst outcomes under different user constraints.

## Core Features

- Multi-domain simulation support (`IT`, `Government Exam`, `MBA/Management`, `Creative/Freelance`).
- Probabilistic stage transitions with timeline generation.
- User-factor adjustments for learning speed, available study time, and financial pressure.
- Scenario generation across multiple runs (`best_case`, `average_case`, `worst_case`).
- Analytics dashboard with stage-time and risk visualizations.
- Career comparison mode between two domains with shared constraints.

## Tech Stack

- Backend: FastAPI
- Frontend: React + Vite + Recharts
- Language: Python, JavaScript

## Project Structure

- `backend.py`: FastAPI app and API endpoints.
- `simulation/simulator.py`: Core simulation engine.
- `data/careers.py`: Domain-specific career graphs.
- `core/`: Shared career model classes (`CareerState`, `Transition`, `CareerPath`, `UserProfile`).
- `ui/src/`: Frontend pages and dashboard UI.

## API Endpoints

- `GET /`: API status message.
- `GET /health`: Health check endpoint.
- `GET /domains`: Available simulation domains.
- `POST /simulate`: Run simulation for one domain.

### `POST /simulate` request body

```json
{
  "domain": "it",
  "hours_per_day": 3,
  "learning_speed": "medium",
  "financial_pressure": "low",
  "runs": 30
}
```

### `POST /simulate` response shape

```json
{
  "domain": "IT Career",
  "inputs": {
    "hours_per_day": 3,
    "learning_speed": "medium",
    "financial_pressure": "low",
    "runs": 30
  },
  "scenarios": {
    "best_case": {
      "total_months": 10.2,
      "failures": 0,
      "timeline": []
    },
    "average_case": {
      "total_months": 12.4,
      "failures": 1,
      "timeline": []
    },
    "worst_case": {
      "total_months": 16.3,
      "failures": 2,
      "timeline": []
    }
  }
}
```

## Local Setup

## 1. Backend

From project root:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend:app --reload
```

Backend runs at `http://127.0.0.1:8000`.

## 2. Frontend

```powershell
cd ui
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173` (or `http://localhost:5173`).

## Notes

- CORS is configured for local Vite hosts.
- The dashboard fetches domain metadata from `GET /domains` and falls back to local defaults if unavailable.
- Simulation request validation is enforced by FastAPI/Pydantic.
