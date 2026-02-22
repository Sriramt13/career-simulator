class CareerState:
    def __init__(
        self,
        name: str,
        base_duration_months: int,
        effort_level: int,            # 1–10
        base_failure_probability: float,
        is_terminal: bool = False
    ):
        self.name = name
        self.base_duration_months = base_duration_months
        self.effort_level = effort_level
        self.base_failure_probability = base_failure_probability
        self.is_terminal = is_terminal

        self.transitions = []  # list of Transition objects

    def add_transition(self, transition):
        self.transitions.append(transition)
