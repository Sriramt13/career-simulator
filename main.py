from core.user_profile import UserProfile
from data.careers import CAREER_REGISTRY
from simulation.simulator import CareerSimulator


def main():
    user = UserProfile(
        education_level="B.Tech",
        available_hours_per_week=18,
        learning_speed="slow",
        financial_pressure="high",
        risk_tolerance="medium"
    )

    career = CAREER_REGISTRY["higher_studies"]()
    simulator = CareerSimulator(career, user)
    result = simulator.run_multiple(runs=30)

    print("\nCareer Simulation Result")
    print("------------------------")
    print(f"Career             : {career.name}")
    print(f"Best case time     : {result['best_case']['total_months']} months")
    print(f"Average case time  : {result['average_case']['total_months']} months")
    print(f"Worst case time    : {result['worst_case']['total_months']} months")
    print(f"Success probability: {result['analytics']['success_probability']}%")


if __name__ == "__main__":
    main()
