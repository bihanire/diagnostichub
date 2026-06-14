from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CaseCreateRequest(BaseModel):
    case_type: str  # repair | frp | return | theft
    client_name: str
    client_phone: str
    client_alt_phone: str | None = None
    client_id_number: str | None = None
    device_model: str
    device_imei: str
    complaint: str
    sim_tray_present: bool | None = None
    lock_type: str | None = None  # pin | pattern | none
    client_pin: str | None = None
    pattern_sequence: str | None = None
    # Diagnostic output — carried from triage session
    sym_code: str | None = None
    src_group: str | None = None
    defect_description: str | None = None
    warranty_direction: str | None = None
    wty_exception: str | None = None
    liquid_exposure: bool | None = None
    drop_or_repair: bool | None = None
    sw_update: bool | None = None
    normal_use: bool | None = None
    asc_name: str | None = None
    asc_code: str | None = None
    ls_code: str | None = None


class CaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reference: str
    case_type: str
    status: str
    ec_location_id: int
    created_by_id: int
    client_name: str
    client_phone: str
    client_alt_phone: str | None
    client_id_number: str | None
    device_model: str
    device_imei: str
    complaint: str
    sim_tray_present: bool | None
    lock_type: str | None
    client_pin: str | None
    pattern_sequence: str | None
    sym_code: str | None
    src_group: str | None
    defect_description: str | None
    warranty_direction: str | None
    wty_exception: str | None
    liquid_exposure: bool | None
    drop_or_repair: bool | None
    sw_update: bool | None
    normal_use: bool | None
    asc_name: str | None
    asc_code: str | None
    ls_code: str | None
    waybill_number: str | None
    photo_front: str | None
    photo_back: str | None
    photo_client_holding: str | None
    photo_pattern: str | None
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    notes: list["CaseNoteItem"] = []


class CaseNoteItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    user_id: int
    author_name: str
    note: str
    created_at: datetime


class CaseNoteCreate(BaseModel):
    note: str


class CaseListResponse(BaseModel):
    cases: list[CaseResponse]
    total: int


class CaseStatsResponse(BaseModel):
    open: int
    dispatched: int
    closed: int
    cancelled: int
    total: int


class CaseStatusUpdateRequest(BaseModel):
    status: str  # dispatched | closed | cancelled
    waybill_number: str | None = None


class CaseStatusUpdateResponse(BaseModel):
    message: str
    case: CaseResponse
