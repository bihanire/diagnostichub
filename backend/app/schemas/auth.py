from pydantic import BaseModel, ConfigDict


class ECLocationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    country_code: str
    region: str | None = None


class ECLocationListResponse(BaseModel):
    locations: list[ECLocationItem]


class AppUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    approval_status: str
    country_code: str | None = None
    ec_location_id: int | None = None
    ec_location: ECLocationItem | None = None


class RegisterRequest(BaseModel):
    ec_location_id: int
    country_code: str


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: AppUserResponse | None = None


class LogoutResponse(BaseModel):
    message: str
