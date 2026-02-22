from core.career_state import CareerState
from core.transition import Transition
from core.career_path import CareerPath


# -----------------------------
# Government Exam Career
# -----------------------------
def government_exam_career():
    beginner = CareerState("Beginner", 3, 3, 0.1)
    prep = CareerState("Preparation", 12, 7, 0.3)
    attempt = CareerState("Attempt", 6, 8, 0.5)
    success = CareerState("Success", 0, 0, 0.0, is_terminal=True)
    burnout = CareerState("Burnout", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, prep, 1.0))
    prep.add_transition(Transition(prep, attempt, 1.0))
    attempt.add_transition(Transition(attempt, success, 0.3))
    attempt.add_transition(Transition(attempt, burnout, 0.7))

    career = CareerPath("Government Exam", beginner)
    for s in [prep, attempt, success, burnout]:
        career.add_state(s)

    return career


# -----------------------------
# IT / Software Career
# -----------------------------
def it_career():
    beginner = CareerState("Beginner", 2, 2, 0.05)
    learning = CareerState("Skill Learning", 6, 5, 0.2)
    job = CareerState("Job Search", 4, 6, 0.3)
    employed = CareerState("Employed", 0, 0, 0.0, is_terminal=True)
    exit = CareerState("Exit", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, learning, 1.0))
    learning.add_transition(Transition(learning, job, 1.0))
    job.add_transition(Transition(job, employed, 0.6))
    job.add_transition(Transition(job, exit, 0.4))

    career = CareerPath("IT Career", beginner)
    for s in [learning, job, employed, exit]:
        career.add_state(s)

    return career


# -----------------------------
# MBA / Management Career
# -----------------------------
def mba_career():
    graduate = CareerState("Graduate", 0, 0, 0.0)
    entrance = CareerState("Entrance Prep", 8, 7, 0.4)
    mba = CareerState("MBA Program", 24, 8, 0.2)
    placement = CareerState("Placements", 6, 7, 0.3)
    manager = CareerState("Manager Role", 0, 0, 0.0, is_terminal=True)
    exit = CareerState("Exit", 0, 0, 0.0, is_terminal=True)

    graduate.add_transition(Transition(graduate, entrance, 1.0))
    entrance.add_transition(Transition(entrance, mba, 0.6))
    entrance.add_transition(Transition(entrance, exit, 0.4))
    mba.add_transition(Transition(mba, placement, 1.0))
    placement.add_transition(Transition(placement, manager, 0.7))
    placement.add_transition(Transition(placement, exit, 0.3))

    career = CareerPath("MBA / Management", graduate)
    for s in [entrance, mba, placement, manager, exit]:
        career.add_state(s)

    return career


# -----------------------------
# Creative / Freelance Career
# -----------------------------
def creative_career():
    beginner = CareerState("Beginner", 3, 2, 0.2)
    skill = CareerState("Skill Development", 6, 5, 0.3)
    freelance = CareerState("Freelancing", 12, 7, 0.4)
    stable = CareerState("Stable Income", 0, 0, 0.0, is_terminal=True)
    exit = CareerState("Exit", 0, 0, 0.0, is_terminal=True)

    beginner.add_transition(Transition(beginner, skill, 1.0))
    skill.add_transition(Transition(skill, freelance, 1.0))
    freelance.add_transition(Transition(freelance, stable, 0.4))
    freelance.add_transition(Transition(freelance, exit, 0.6))

    career = CareerPath("Creative / Freelance", beginner)
    for s in [skill, freelance, stable, exit]:
        career.add_state(s)

    return career


# -----------------------------
# MULTI-DOMAIN REGISTRY
# -----------------------------
CAREER_REGISTRY = {
    "government_exam": government_exam_career,
    "it": it_career,
    "mba": mba_career,
    "creative": creative_career
}
