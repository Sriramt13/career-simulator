import random


class CareerSimulator:
    def __init__(self, career_path, user_profile):
        self.career_path = career_path
        self.user = user_profile

    # --------------------------------
    # Adjust time based on user profile
    # --------------------------------
    def adjusted_duration(self, base_months):
        duration = base_months

        if self.user.learning_speed == "slow":
            duration *= 1.3
        elif self.user.learning_speed == "fast":
            duration *= 0.8

        if self.user.available_hours_per_week < 20:
            duration *= 1.2

        # 🔹 ADD SMALL RANDOM VARIATION (±15%)
        variation = random.uniform(0.85, 1.15)
        duration *= variation

        return round(duration, 2)

    # --------------------------------
    # Adjust failure risk based on user
    # --------------------------------
    def adjusted_failure_probability(self, base_risk):
        risk = base_risk

        if self.user.financial_pressure == "high":
            risk *= 1.2
        elif self.user.financial_pressure == "low":
            risk *= 0.9

        return min(round(risk, 2), 0.95)

    # --------------------------------
    # Run ONE simulation (core engine)
    # --------------------------------
    def run_once(self, max_months=240):
        current_state = self.career_path.start_state
        total_months = 0
        failures = 0
        timeline = []

        while not current_state.is_terminal and total_months < max_months:
            duration = self.adjusted_duration(
                current_state.base_duration_months
            )
            risk = self.adjusted_failure_probability(
                current_state.base_failure_probability
            )

            # Record timeline step
            timeline.append({
                "stage": current_state.name,
                "months": duration,
                "risk": risk,
                "status": "success"
            })

            total_months += duration

            # Decide next transition
            r = random.random()
            cumulative = 0
            next_state = None

            for t in current_state.transitions:
                cumulative += t.probability
                if r <= cumulative:
                    next_state = t.to_state
                    break

            if next_state is None:
                break

            # Failure / exit handling
            if next_state.name.lower() in ["burnout", "exit"]:
                failures += 1
                timeline[-1]["status"] = "failed"
                timeline[-1]["note"] = "Failed here — exit or burnout"

            current_state = next_state

        return {
            "final_state": current_state.name,
            "total_months": round(total_months, 2),
            "failures": failures,
            "timeline": timeline
        }

    # --------------------------------
    # Run MULTIPLE simulations
    # Returns best / average / worst timelines
    # --------------------------------
    def run_multiple(self, runs=30):
        results = []

        for _ in range(runs):
            results.append(self.run_once())

        # Sort simulations by total duration
        results.sort(key=lambda x: x["total_months"])

        best = results[0]
        worst = results[-1]
        average = results[len(results) // 2]

        return {
            "best_case": {
                "total_months": best["total_months"],
                "failures": best["failures"],
                "timeline": best["timeline"]
            },
            "average_case": {
                "total_months": average["total_months"],
                "failures": average["failures"],
                "timeline": average["timeline"]
            },
            "worst_case": {
                "total_months": worst["total_months"],
                "failures": worst["failures"],
                "timeline": worst["timeline"]
            }
        }
