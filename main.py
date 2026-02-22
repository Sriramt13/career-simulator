from core.user_profile import UserProfile
from data.careers import government_exam
from simulation.simulator import CareerSimulator


def main():
    user = UserProfile(
        education_level="B.Tech",
        available_hours_per_week=18,
        learning_speed="slow",
        financial_pressure="high",
        risk_tolerance="medium"
    )

    simulator = CareerSimulator(government_exam, user)
    result = simulator.run_multiple(runs=30)

    print("\nCareer Simulation Result")
    print("------------------------")
    print(f"Best case time     : {result['best_case']} months")
    print(f"Average case time  : {result['average_case']} months")
    print(f"Worst case time    : {result['worst_case']} months")


if __name__ == "__main__":
    main()
