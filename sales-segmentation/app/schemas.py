"""Skema request/response (Pydantic)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

ORM = ConfigDict(from_attributes=True)

# Catatan: EmailStr menolak domain "special-use" seperti .local dan .internal.
# Kalau nanti kantor memakai domain internal semacam itu untuk akun, validasi
# ini yang perlu dilonggarkan.
STAGES = ("Leads", "Prospecting", "Negotiating", "Won", "Lost", "Hold")
QUARTERS = ("Q1", "Q2", "Q3", "Q4")


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ORM
    id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    sales_id: Optional[str] = None
    created_date: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: Literal["admin", "head_sales", "sales"] = "sales"
    sales_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    role: Optional[Literal["admin", "head_sales", "sales"]] = None
    is_active: Optional[bool] = None
    sales_id: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordReset(BaseModel):
    """Reset oleh admin — tidak butuh password lama."""
    new_password: str = Field(min_length=8, max_length=128)


# --------------------------------------------------------------------------- #
# Entity
# --------------------------------------------------------------------------- #
class CustomerBase(BaseModel):
    company: str = Field(min_length=1, max_length=255)
    pic: str = Field(min_length=1, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: str = Field(min_length=1, max_length=120)
    address: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company: Optional[str] = None
    pic: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None


class CustomerOut(CustomerBase):
    model_config = ORM
    id: str
    created_date: datetime


class SalesBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str
    username: str
    status: Literal["Active", "Inactive"] = "Active"
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    target: Optional[float] = None


class SalesCreate(SalesBase):
    pass


class SalesUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    status: Optional[Literal["Active", "Inactive"]] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    target: Optional[float] = None


class SalesOut(SalesBase):
    model_config = ORM
    id: str
    created_date: datetime


class PipelineBase(BaseModel):
    customer: str = Field(min_length=1, max_length=255)
    company: Optional[str] = None
    industry: Optional[str] = None
    project_name: str = Field(min_length=1, max_length=500)
    project_category: Optional[str] = None
    estimated_value: float = 0
    estimated_closing: Optional[str] = None
    pic: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    stage: Literal[STAGES] = "Leads"  # type: ignore[valid-type]
    sales_name: Optional[str] = None
    quarter: Optional[Literal[QUARTERS]] = None  # type: ignore[valid-type]
    year: Optional[int] = None
    status: Literal["Active", "Closed", "On Hold"] = "Active"


class PipelineCreate(PipelineBase):
    pass


class PipelineUpdate(BaseModel):
    customer: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    project_name: Optional[str] = None
    project_category: Optional[str] = None
    estimated_value: Optional[float] = None
    estimated_closing: Optional[str] = None
    pic: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    stage: Optional[Literal[STAGES]] = None  # type: ignore[valid-type]
    sales_name: Optional[str] = None
    quarter: Optional[Literal[QUARTERS]] = None  # type: ignore[valid-type]
    year: Optional[int] = None
    status: Optional[Literal["Active", "Closed", "On Hold"]] = None


class PipelineOut(PipelineBase):
    model_config = ORM
    id: str
    created_date: datetime


class ClusteringResultOut(BaseModel):
    model_config = ORM
    id: str
    sales_name: str
    quarter: str
    year: int
    lead: float
    prospecting: float
    negotiating: float
    won: float
    lost: float
    hold: float
    win_rate: float
    loss_rate: float
    cluster: str
    score: float
    recommendation: Optional[str] = None
    silhouette_score: Optional[float] = None
    created_date: datetime


# --------------------------------------------------------------------------- #
# Clustering
# --------------------------------------------------------------------------- #
class SegmentRequest(BaseModel):
    """Segmentasi atas data pipeline yang sudah tersimpan di database."""
    quarter: Literal[QUARTERS]  # type: ignore[valid-type]
    year: int
    k: int = Field(default=3, ge=2, le=6)
    save: bool = True


class SalesResult(BaseModel):
    name: str
    lead: float
    prospecting: float
    negotiation: float
    won: float
    lost: float
    hold: float
    win_rate: float
    loss_rate: float
    cluster: int
    score: float
    label: str
    cluster_name: str
    recommendation: str


class SegmentResponse(BaseModel):
    results: List[SalesResult]
    silhouette: Optional[float]
    n_rows: int
    k: int
    features_used: List[str]
    insights: List[Dict[str, Any]]
    saved: bool


class SweepRequest(BaseModel):
    quarter: Literal[QUARTERS]  # type: ignore[valid-type]
    year: int
    k_values: List[int] = Field(default=[2, 3, 4, 5])


# --------------------------------------------------------------------------- #
# Upload
# --------------------------------------------------------------------------- #
class UploadPreview(BaseModel):
    rows: List[Dict[str, Any]]
    total: int
    columns: List[str]
    warnings: List[str]


class ImportRequest(BaseModel):
    rows: List[PipelineCreate]


class ImportResult(BaseModel):
    imported: int
