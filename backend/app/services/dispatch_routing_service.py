from __future__ import annotations

from typing import Literal, TypedDict

# T-codes and src_group values that represent customer-requested services
# (FRP unlock, accessory query, setting change). These route to Banana ASC,
# not Transtel, and are always OOW regardless of the warranty phase verdict.
CUSTOMER_REQUEST_IDENTIFIERS = {"CUSTOMER_REQUEST", "T01", "T02", "T03"}

DispatchClass = Literal["iw_hardware", "ow_hardware", "customer_request", "needs_review"]


class DispatchRoute(TypedDict):
    ls_code: str | None
    service_center: str | None
    route_note: str
    escalate: bool
    dispatch_class: DispatchClass


def get_dispatch_route(
    src_group: str | None,
    primary_t_code: str | None,
    warranty_direction: Literal["IW", "OW"] | None,
    warranty_needs_review: bool = False,
) -> DispatchRoute:
    """Map symptom taxonomy + warranty verdict → LS code + service center.

    Does not compute 30/70 eligibility or arrears — those require MIFOS data
    and supervisor confirmation. This function only resolves the routing class
    and the correct LS code to log.
    """
    if warranty_needs_review:
        return _needs_review()

    src = (src_group or "").upper().strip()
    t_code = (primary_t_code or "").upper().strip()

    if src in CUSTOMER_REQUEST_IDENTIFIERS or t_code in CUSTOMER_REQUEST_IDENTIFIERS:
        return _customer_request()

    if warranty_direction == "IW":
        return _iw_hardware()

    if warranty_direction == "OW":
        return _ow_hardware()

    return _needs_review()


def _iw_hardware() -> DispatchRoute:
    return {
        "ls_code": "Self Repairs",
        "service_center": "Transtel",
        "route_note": (
            "In-warranty repair. Log LS: Self Repairs in MIFOS. "
            "Kampala branches use in-house daily courier. "
            "Upcountry branches dispatch via Aramex direct to service centre."
        ),
        "escalate": False,
        "dispatch_class": "iw_hardware",
    }


def _ow_hardware() -> DispatchRoute:
    return {
        "ls_code": "Watu Repairs",
        "service_center": "Watu SIMU HQ",
        "route_note": (
            "Out-of-warranty repair. Log LS: Watu Repairs in MIFOS. "
            "Confirm 30/70 eligibility with your supervisor before dispatch — "
            "this depends on customer arrears and prior repair history. "
            "Route device to Watu SIMU HQ first (NOT directly to Transtel). "
            "Kampala in-house courier delivers to HQ daily; "
            "upcountry branches dispatch via Aramex addressed to Watu SIMU HQ."
        ),
        "escalate": False,
        "dispatch_class": "ow_hardware",
    }


def _customer_request() -> DispatchRoute:
    return {
        "ls_code": "Watu Repairs",
        "service_center": "Banana ASC",
        "route_note": (
            "Customer-requested service (FRP unlock / credential / accessory). "
            "Log LS: Watu Repairs in MIFOS. "
            "Route to Banana ASC — no Samsung warranty claim applies. "
            "Confirm service fee with Banana ASC before handover."
        ),
        "escalate": False,
        "dispatch_class": "customer_request",
    }


def _needs_review() -> DispatchRoute:
    return {
        "ls_code": None,
        "service_center": None,
        "route_note": (
            "Warranty direction could not be confirmed. "
            "Escalate to your supervisor before logging an LS code or dispatching the device."
        ),
        "escalate": True,
        "dispatch_class": "needs_review",
    }
