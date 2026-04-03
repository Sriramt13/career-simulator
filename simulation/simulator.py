import random


class CareerSimulator:
    """
    Probabilistic career path simulation engine.
    
    Design:
    - Simulates one career path at a time (initialized with specific career object)
    - Each run() produces one possible timeline from start to terminal state
    - User profile (learning_speed, financial_pressure) modifies probabilities
    - Multiple runs (typically 30-100) aggregate to show best/avg/worst outcomes
    
    Customization:
    - adjusted_duration(): Applies user learning_speed and study hours to stage time
    - adjusted_failure_probability(): Applies user financial_pressure to failure risk
    - _weighted_transition_choice(): Risk-based state selection (high risk → failures more likely)
    
    Usage:
        simulator = CareerSimulator(career, user_profile)
        outcomes = simulator.run_multiple(runs=50)
        # outcomes["average_case"] = representative timeline
        # outcomes["analytics"] = success_probability, bottleneck_stage
    """
    def __init__(self, career_path, user_profile):
        self.career_path = career_path
        self.user = user_profile

    # --------------------------------
    # Adjust time based on user profile
    # --------------------------------
    def adjusted_duration(self, base_months):
        """
        Adjust stage duration based on user profile.
        
        Adjustments:
        - Learning speed: slow (+30%), fast (-20%)
        - Low study hours: +20%
        - Random variation: ±15% (realism)
        """
        duration = base_months

        if self.user.learning_speed == "slow":
            duration *= 1.3
        elif self.user.learning_speed == "fast":
            duration *= 0.8

        if self.user.available_hours_per_week < 20:
            duration *= 1.2

        # Add small random variation (±15%) for realistic diversity
        variation = random.uniform(0.85, 1.15)
        duration *= variation

        return round(duration, 2)

    # --------------------------------
    # Adjust failure risk based on user
    # --------------------------------
    def adjusted_failure_probability(self, base_risk):
        """
        Adjust stage failure probability based on user profile.
        
        Adjustments:
        - High financial pressure: +20%
        - Low financial pressure: -10%
        - Capped at 95% max (some paths remain viable)
        """
        risk = base_risk

        if self.user.financial_pressure == "high":
            risk *= 1.2
        elif self.user.financial_pressure == "low":
            risk *= 0.9

        return min(round(risk, 2), 0.95)

    def _weighted_transition_choice(self, transitions, risk):
        """
        Select next state using risk-adjusted weighted probability.
        
        Logic:
        - High risk → biases toward failure/exit states (burnout, exit)
        - Low risk → biases toward success states
        - Minimum weight of 0.2 prevents zero-probability transitions
        
        Args:
            transitions: List of Transition objects with to_state and probability
            risk: Current adjusted failure probability (0.0-0.95)
        
        Returns:
            Selected next state or None if no transitions available
        """
        if not transitions:
            return None

        weighted = []
        for transition in transitions:
            target_name = transition.to_state.name.lower()
            is_failure_target = target_name in ["burnout", "exit"]

            # Base weight from transition probability
            weight = max(transition.probability, 0)
            
            # Risk-based bias: failures more likely under high risk, success more likely under low risk
            if is_failure_target:
                weight *= max(0.2, risk / 0.5)
            else:
                weight *= max(0.2, (1 - risk) / 0.5)

            weighted.append((transition, weight))

        total = sum(weight for _, weight in weighted)
        if total <= 0:
            return None

        # Weighted random selection
        pick = random.uniform(0, total)
        cumulative = 0

        for transition, weight in weighted:
            cumulative += weight
            if pick <= cumulative:
                return transition.to_state

        return weighted[-1][0].to_state

    # --------------------------------
    # Run ONE simulation (core engine)
    # --------------------------------
    def run_once(self, max_months=240):
        """
        Execute one complete career simulation from start to terminal state.
        
        Process:
        1. Start at career path's initial state
        2. For each stage:
           - Adjust duration and failure probability based on user profile
           - Record timeline entry with stage name, duration, risk
           - Move to next state via weighted transition
           - If terminal state reached or max_months exceeded, stop
        3. Count failures (burnout/exit) and return timeline
        
        Args:
            max_months: Simulation timeout (prevent infinite loops)
        
        Returns:
            Dict with final_state, total_months, failures, timeline
        """
        current_state = self.career_path.start_state
        total_months = 0
        failures = 0
        timeline = []

        while not current_state.is_terminal and total_months < max_months:
            # Adjust duration and risk for current user profile
            duration = self.adjusted_duration(
                current_state.base_duration_months
            )
            risk = self.adjusted_failure_probability(
                current_state.base_failure_probability
            )

            # Record stage entry
            timeline.append({
                "stage": current_state.name,
                "months": duration,
                "risk": risk,
                "status": "success"
            })

            total_months += duration

            # Choose next state using risk-weighted probability
            next_state = self._weighted_transition_choice(
                current_state.transitions,
                risk,
            )

            if next_state is None:
                break

            # Track burnout/exit as failures
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
        """
        Execute M simulations and aggregate results into best/average/worst scenarios.
        
        Process:
        1. Run `runs` independent simulations (each calls run_once())
        2. Sort by total_months to get best (fastest) and worst (slowest)
        3. Select median as average (representative middle case)
        4. Compute analytics:
           - success_probability: % of runs ending in success (not burnout/exit)
           - bottleneck_stage: stage with highest average duration
           - bottleneck_avg_months: average months spent in bottleneck stage
        
        Args:
            runs: Number of simulations (typically 5-500)
        
        Returns:
            Dict with best_case, average_case, worst_case, analytics
        """
        results = []

        # Run M independent simulations
        for _ in range(runs):
            results.append(self.run_once())

        # Sort by total duration: shortest first
        results.sort(key=lambda x: x["total_months"])

        best = results[0]
        worst = results[-1]
        average = results[len(results) // 2]

        # Aggregate analytics across all runs
        success_count = 0
        burnout_count = 0
        exit_count = 0
        stage_month_totals = {}
        stage_month_counts = {}

        for run in results:
            final_state = str(run.get("final_state", "")).lower()
            # Success = terminal states that are not explicit failure exits
            if final_state not in ["burnout", "exit"]:
                success_count += 1
            elif final_state == "burnout":
                burnout_count += 1
            else:
                # Exit is a generic failure terminal used in several domains.
                exit_count += 1

            # Accumulate per-stage data for bottleneck detection
            for stage in run.get("timeline", []):
                stage_name = stage.get("stage")
                months = float(stage.get("months", 0) or 0)
                if not stage_name:
                    continue

                stage_month_totals[stage_name] = stage_month_totals.get(stage_name, 0.0) + months
                stage_month_counts[stage_name] = stage_month_counts.get(stage_name, 0) + 1

        # Find bottleneck (stage with highest average duration)
        bottleneck_stage = None
        bottleneck_avg_months = 0.0
        for stage_name, total in stage_month_totals.items():
            count = stage_month_counts.get(stage_name, 0)
            if count <= 0:
                continue

            avg_months = total / count
            if avg_months > bottleneck_avg_months:
                bottleneck_avg_months = avg_months
                bottleneck_stage = stage_name

        # Compute outcome probabilities as percentage split.
        # Split non-burnout failures between retry vs burnout/exit for UI clarity.
        success_probability = (success_count / runs) * 100 if runs > 0 else 0
        burnout_direct_probability = (burnout_count / runs) * 100 if runs > 0 else 0
        exit_failure_probability = (exit_count / runs) * 100 if runs > 0 else 0

        # User-profile-aware retry tendency: fewer hours or slower learning => more retries.
        hours_per_day = max(1.0, min(16.0, float(self.user.available_hours_per_week) / 7.0))
        retry_bias = 0.35 + ((16.0 - hours_per_day) / 16.0) * 0.2
        if self.user.learning_speed == "slow":
            retry_bias += 0.1
        elif self.user.learning_speed == "fast":
            retry_bias -= 0.1
        retry_bias = max(0.0, min(1.0, retry_bias))

        retry_probability = exit_failure_probability * retry_bias
        burnout_probability = burnout_direct_probability + (exit_failure_probability * (1.0 - retry_bias))

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
            },
            "analytics": {
                "success_probability": round(success_probability, 2),
                "retry_probability": round(retry_probability, 2),
                "burnout_probability": round(burnout_probability, 2),
                "bottleneck_stage": bottleneck_stage,
                "bottleneck_avg_months": round(bottleneck_avg_months, 2)
            }
        }
