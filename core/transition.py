class Transition:
    def __init__(
        self,
        from_state,
        to_state,
        probability: float,
        condition: callable = None,
        description: str = ""
    ):
        self.from_state = from_state
        self.to_state = to_state
        self.probability = probability
        self.condition = condition
        self.description = description

    def is_allowed(self, user_profile):
        if self.condition is None:
            return True
        return self.condition(user_profile)
