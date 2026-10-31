from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business_name: str = Field(min_length=2, max_length=160)
    role: str = Field(default="owner")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    platform_role: str
    brand_tone: str


class TenantOut(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    status: str
    role: str


class MeResponse(BaseModel):
    user: UserOut
    tenant: Optional[TenantOut]
    google_connected: bool
    selected_location_count: int
