class UserProfile:
    def __init__(
        self,
        education_level: str,
        available_hours_per_week: int,
        learning_speed: str,      # slow / medium / fast
        financial_pressure: str,  # low / medium / high
        risk_tolerance: str       # low / medium / high
    ):
        self.education_level = education_level
        self.available_hours_per_week = available_hours_per_week
        self.learning_speed = learning_speed
        self.financial_pressure = financial_pressure
        self.risk_tolerance = risk_tolerance
