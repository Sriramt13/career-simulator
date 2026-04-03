from core.career_state import CareerState
from core.transition import Transition
from core.career_path import CareerPath


# -----------------------------
# IT Career
# -----------------------------
def it_career():
    beginner = CareerState("Beginner", 2, 2, 0.05)
    learning = CareerState("Skill Learning", 6, 5, 0.2)
    job = CareerState("Job Search", 4, 6, 0.3)
    employed = CareerState("Employed", 0, 0, 0.0, is_terminal=True)
    exit_state = CareerState("Exit", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, learning, 1.0))
    learning.add_transition(Transition(learning, job, 1.0))
    job.add_transition(Transition(job, employed, 0.6))
    job.add_transition(Transition(job, exit_state, 0.4))

    career = CareerPath("IT Career", beginner)
    for state in [learning, job, employed, exit_state]:
        career.add_state(state)

    return career


# -----------------------------
# Higher Studies
# -----------------------------
def higher_studies_career():
    beginner = CareerState("Beginner", 2, 2, 0.08)
    prep = CareerState("Preparation", 10, 7, 0.35)
    attempt = CareerState("Attempt", 5, 8, 0.45)
    program = CareerState("Higher Studies Program", 18, 7, 0.2)
    placements = CareerState("Placements", 5, 7, 0.25)
    success = CareerState("Success", 0, 0, 0.0, is_terminal=True)
    burnout = CareerState("Burnout", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, prep, 1.0))
    prep.add_transition(Transition(prep, attempt, 1.0))
    attempt.add_transition(Transition(attempt, program, 0.62))
    attempt.add_transition(Transition(attempt, burnout, 0.38))
    program.add_transition(Transition(program, placements, 1.0))
    placements.add_transition(Transition(placements, success, 0.72))
    placements.add_transition(Transition(placements, burnout, 0.28))

    career = CareerPath("Higher Studies", beginner)
    for state in [prep, attempt, program, placements, success, burnout]:
        career.add_state(state)

    return career


# -----------------------------
# Startup
# -----------------------------
def startup_career():
    beginner = CareerState("Beginner", 2, 3, 0.15)
    ideation = CareerState("Ideation", 4, 6, 0.3)
    mvp = CareerState("MVP Build", 6, 8, 0.42)
    validation = CareerState("Market Validation", 5, 8, 0.48)
    growth = CareerState("Growth", 10, 8, 0.35)
    success = CareerState("Success", 0, 0, 0.0, is_terminal=True)
    exit_state = CareerState("Exit", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, ideation, 1.0))
    ideation.add_transition(Transition(ideation, mvp, 1.0))
    mvp.add_transition(Transition(mvp, validation, 0.8))
    mvp.add_transition(Transition(mvp, exit_state, 0.2))
    validation.add_transition(Transition(validation, growth, 0.55))
    validation.add_transition(Transition(validation, exit_state, 0.45))
    growth.add_transition(Transition(growth, success, 0.6))
    growth.add_transition(Transition(growth, exit_state, 0.4))

    career = CareerPath("Startup", beginner)
    for state in [ideation, mvp, validation, growth, success, exit_state]:
        career.add_state(state)

    return career


# -----------------------------
# Creative Career
# -----------------------------
def creative_career():
    beginner = CareerState("Beginner", 3, 2, 0.2)
    skill = CareerState("Skill Development", 6, 5, 0.3)
    portfolio = CareerState("Portfolio Building", 5, 6, 0.35)
    client_work = CareerState("Client Projects", 8, 7, 0.38)
    success = CareerState("Success", 0, 0, 0.0, is_terminal=True)
    exit_state = CareerState("Exit", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, skill, 1.0))
    skill.add_transition(Transition(skill, portfolio, 1.0))
    portfolio.add_transition(Transition(portfolio, client_work, 0.72))
    portfolio.add_transition(Transition(portfolio, exit_state, 0.28))
    client_work.add_transition(Transition(client_work, success, 0.58))
    client_work.add_transition(Transition(client_work, exit_state, 0.42))

    career = CareerPath("Creative Career", beginner)
    for state in [skill, portfolio, client_work, success, exit_state]:
        career.add_state(state)

    return career


# -----------------------------
# Freelancing
# -----------------------------
def freelancing_career():
    beginner = CareerState("Beginner", 2, 3, 0.12)
    skill = CareerState("Skill Learning", 5, 5, 0.24)
    outreach = CareerState("Client Outreach", 4, 6, 0.34)
    freelancing = CareerState("Freelancing", 10, 7, 0.36)
    stable = CareerState("Stable Income", 0, 0, 0.0, is_terminal=True)
    burnout = CareerState("Burnout", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, skill, 1.0))
    skill.add_transition(Transition(skill, outreach, 1.0))
    outreach.add_transition(Transition(outreach, freelancing, 0.7))
    outreach.add_transition(Transition(outreach, burnout, 0.3))
    freelancing.add_transition(Transition(freelancing, stable, 0.62))
    freelancing.add_transition(Transition(freelancing, burnout, 0.38))

    career = CareerPath("Freelancing", beginner)
    for state in [skill, outreach, freelancing, stable, burnout]:
        career.add_state(state)

    return career


# -----------------------------
# MULTI-DOMAIN REGISTRY
# -----------------------------
CAREER_REGISTRY = {
    "it": it_career,
    "higher_studies": higher_studies_career,
    "startup": startup_career,
    "creative": creative_career,
    "freelancing": freelancing_career,
}
