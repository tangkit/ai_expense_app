"""Pydantic models for expense data structures."""

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ExpenseCategory(str, Enum):
    """Supported expense categories."""

    TAXI = "taxi"
    RIDESHARE = "rideshare"
    HOTEL = "hotel"
    FLIGHT = "flight"
    MEAL = "meal"
    PARKING = "parking"
    TOLL = "toll"
    PUBLIC_TRANSPORT = "public_transport"
    CAR_RENTAL = "car_rental"
    FUEL = "fuel"
    CONFERENCE = "conference"
    OFFICE_SUPPLIES = "office_supplies"
    OTHER = "other"


class HotelNightItem(BaseModel):
    """Itemized breakdown for a single hotel night."""

    night_date: date = Field(..., description="Date of the hotel stay night")
    room_rate: Decimal = Field(..., ge=0, description="Base room rate")
    room_tax: Decimal = Field(default=Decimal("0"), ge=0, description="Room tax amount")
    service_charge: Decimal = Field(
        default=Decimal("0"), ge=0, description="Service charge"
    )
    resort_fee: Decimal = Field(default=Decimal("0"), ge=0, description="Resort/amenity fee")
    parking_fee: Decimal = Field(default=Decimal("0"), ge=0, description="Parking fee")
    other_fees: Decimal = Field(default=Decimal("0"), ge=0, description="Other fees")

    @property
    def daily_total(self) -> Decimal:
        """Calculate total for this night."""
        return (
            self.room_rate
            + self.room_tax
            + self.service_charge
            + self.resort_fee
            + self.parking_fee
            + self.other_fees
        )


class MealCompanionInfo(BaseModel):
    """Companion information required for meals over threshold."""

    companion_name: str = Field(..., min_length=1, description="Name of dining companion")
    companion_title: Optional[str] = Field(None, description="Title/company of companion")
    attendee_count: int = Field(default=2, ge=1, description="Number of attendees")
    business_purpose: str = Field(..., min_length=1, description="Business purpose of meal")
    discussion_topics: Optional[str] = Field(None, description="Topics discussed")


class ExtractedExpense(BaseModel):
    """Expense data extracted from a receipt."""

    # Core fields
    vendor: str = Field(..., min_length=1, description="Vendor/merchant name")
    category: ExpenseCategory = Field(..., description="Expense category")
    expense_date: date = Field(..., description="Date of expense")
    description: Optional[str] = Field(None, description="Description of expense")

    # Amount fields
    subtotal: Decimal = Field(..., ge=0, description="Subtotal before tax")
    tax: Decimal = Field(default=Decimal("0"), ge=0, description="Tax amount")
    total: Decimal = Field(..., ge=0, description="Total amount")
    currency: str = Field(default="USD", description="Currency code")

    # Receipt info
    receipt_number: Optional[str] = Field(None, description="Receipt/invoice number")
    payment_method: Optional[str] = Field(None, description="Payment method used")

    # Hotel-specific fields
    check_in_date: Optional[date] = Field(None, description="Hotel check-in date")
    check_out_date: Optional[date] = Field(None, description="Hotel check-out date")
    hotel_itemization: Optional[list[HotelNightItem]] = Field(
        None, description="Per-night breakdown for hotels"
    )

    # Meal companion fields
    companion_info: Optional[MealCompanionInfo] = Field(
        None, description="Companion info for meals over threshold"
    )

    # Metadata
    confidence_score: float = Field(
        default=0.0, ge=0, le=1, description="AI confidence in extraction"
    )
    requires_companion: bool = Field(
        default=False, description="Whether companion info is required"
    )
    requires_itemization: bool = Field(
        default=False, description="Whether itemization is required"
    )

    # Additional fields
    business_purpose: Optional[str] = Field(None, description="Business purpose")
    project_code: Optional[str] = Field(None, description="Project/cost center code")
    notes: Optional[str] = Field(None, description="Additional notes")

    @field_validator("total", mode="before")
    @classmethod
    def ensure_decimal(cls, v):
        """Ensure total is a Decimal."""
        if isinstance(v, (int, float)):
            return Decimal(str(v))
        return v


class ExpenseParseRequest(BaseModel):
    """Request model for parsing a receipt."""

    file_name: str = Field(..., description="Name of uploaded file")
    file_type: str = Field(..., description="MIME type of file")
    file_content_base64: str = Field(..., description="Base64-encoded file content")


class ExpenseParseResponse(BaseModel):
    """Response model for parsed receipt."""

    success: bool = Field(..., description="Whether parsing succeeded")
    expense: Optional[ExtractedExpense] = Field(None, description="Extracted expense data")
    raw_text: Optional[str] = Field(None, description="Raw text extracted from receipt")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")


class ExpenseValidationResult(BaseModel):
    """Result of expense validation."""

    is_valid: bool = Field(..., description="Whether expense data is valid")
    errors: list[str] = Field(default_factory=list, description="Validation errors")
    warnings: list[str] = Field(default_factory=list, description="Validation warnings")


class ExportRequest(BaseModel):
    """Request model for exporting expenses."""

    expenses: list[ExtractedExpense] = Field(..., description="Expenses to export")
    format: str = Field(default="xlsx", description="Export format (xlsx or csv)")
    include_itemization: bool = Field(
        default=True, description="Include hotel itemization sheet"
    )
    include_companion_sheet: bool = Field(
        default=True, description="Include meals companion sheet"
    )


class ExportResponse(BaseModel):
    """Response model for expense export."""

    success: bool = Field(..., description="Whether export succeeded")
    file_name: str = Field(..., description="Generated file name")
    file_content_base64: str = Field(..., description="Base64-encoded file content")
    error_message: Optional[str] = Field(None, description="Error message if failed")
