from __future__ import annotations

from typing import Literal

CUSTOMER_REQUEST_T_CODES = {"T01", "T02", "T03"}

WARRANTY_QUESTIONS: list[str] = [
    "Was the device exposed to liquid or moisture at any point?",
    "Has the device been dropped, or was it previously opened or repaired?",
    "Did this fault appear immediately after a software or firmware update?",
    "Was the device in normal everyday use when this problem started?",
]

WarrantyDirection = Literal["IW", "OW"]


def evaluate_warranty(
    primary_t_code: str,
    answers: list[Literal["yes", "no"]],
) -> dict:
    """Stateless warranty evaluator.

    Given the T-code and the answers collected so far (one per question, in order),
    returns either the next question to ask or the final warranty verdict.

    T01/T02/T03 are customer-request codes (accessory swap, setting change, etc.)
    that are always IW — skip all questions.
    """
    if primary_t_code.upper() in CUSTOMER_REQUEST_T_CODES:
        # Customer-request codes (accessory swap, setting change, FRP unlock) have
        # no Samsung hardware warranty question to answer. Auto-skip returns
        # status="complete" with warranty_direction="IW" as a sentinel meaning
        # "no defect assessed" — NOT that Samsung covers the cost. The dispatch
        # routing layer (dispatch_routing_service) handles these as OOW customer
        # services routed to Banana ASC.
        return _auto_iw()

    # Evaluate answers in order and stop early when a verdict is reached.
    for i, answer in enumerate(answers):
        if i == 0 and answer == "yes":
            # Liquid exposure → OOW, void
            return _complete("OW", "VOID4")
        if i == 1 and answer == "yes":
            # Dropped or previously repaired → OOW, void
            return _complete("OW", "VOID4")
        if i == 2 and answer == "yes":
            # Fault triggered by software update → IW
            return _complete("IW", None)
        if i == 3:
            if answer == "yes":
                # Normal-use fault → IW
                return _complete("IW", None)
            else:
                # Not normal use and no other flag → escalate for review
                return _needs_review()

    # Return the next unanswered question.
    next_index = len(answers)
    if next_index >= len(WARRANTY_QUESTIONS):
        return _needs_review()

    return {
        "status": "question",
        "question_index": next_index,
        "question": WARRANTY_QUESTIONS[next_index],
        "warranty_direction": None,
        "wty_exception": None,
        "needs_review": False,
        "auto_skipped": False,
    }


def _complete(direction: WarrantyDirection, exception: str | None) -> dict:
    return {
        "status": "complete",
        "question_index": None,
        "question": None,
        "warranty_direction": direction,
        "wty_exception": exception,
        "needs_review": False,
        "auto_skipped": False,
    }


def _auto_iw() -> dict:
    return {
        "status": "complete",
        "question_index": None,
        "question": None,
        "warranty_direction": "IW",
        "wty_exception": None,
        "needs_review": False,
        "auto_skipped": True,
    }


def _needs_review() -> dict:
    return {
        "status": "complete",
        "question_index": None,
        "question": None,
        "warranty_direction": None,
        "wty_exception": None,
        "needs_review": True,
        "auto_skipped": False,
    }
