class CareerPath:
    def __init__(self, name: str, start_state):
        self.name = name
        self.start_state = start_state
        self.states = {}

        self.add_state(start_state)

    def add_state(self, state):
        self.states[state.name] = state

    def get_state(self, name):
        return self.states.get(name)
