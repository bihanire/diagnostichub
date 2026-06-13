from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Device
from app.schemas.triage import DeviceItem, DeviceListResponse


def get_all_devices(db: Session) -> DeviceListResponse:
    rows = db.scalars(
        select(Device)
        .where(Device.is_active == True)  # noqa: E712
        .order_by(Device.sort_order, Device.id)
    ).all()
    return DeviceListResponse(devices=[DeviceItem.model_validate(row) for row in rows])
