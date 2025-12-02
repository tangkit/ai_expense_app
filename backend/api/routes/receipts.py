"""Receipt upload and parsing routes."""

import base64
from typing import Annotated

from fastapi import APIRouter, File, UploadFile, HTTPException, Form

from api.schemas.expense import ExpenseParseRequest, ExpenseParseResponse
from agents.receipt_parser import receipt_parser_agent
from config import settings

router = APIRouter()


@router.post("/parse", response_model=ExpenseParseResponse)
async def parse_receipt(file: UploadFile = File(...)) -> ExpenseParseResponse:
    """
    Parse an uploaded receipt and extract expense information.

    Accepts image files (JPEG, PNG, WebP) and PDF documents.
    Uses AI-powered vision and OCR to extract:
    - Vendor name
    - Amount and tax
    - Date
    - Category
    - Receipt number

    For hotel receipts, generates per-night itemization.
    For meals over $25, flags companion information requirement.
    """
    # Validate file type
    is_valid, error = receipt_parser_agent.validate_file(
        file.content_type or "application/octet-stream",
        file.size or 0,
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Read and encode file content
    content = await file.read()
    content_base64 = base64.b64encode(content).decode("utf-8")

    # Parse the receipt
    result = await receipt_parser_agent.parse_receipt(
        file_content_base64=content_base64,
        file_type=file.content_type or "application/octet-stream",
        file_name=file.filename or "unknown",
    )

    return result


@router.post("/parse-base64", response_model=ExpenseParseResponse)
async def parse_receipt_base64(request: ExpenseParseRequest) -> ExpenseParseResponse:
    """
    Parse a base64-encoded receipt and extract expense information.

    Alternative endpoint for clients that prefer to send base64-encoded content
    directly rather than using multipart form upload.
    """
    # Validate file type
    is_valid, error = receipt_parser_agent.validate_file(
        request.file_type,
        len(base64.b64decode(request.file_content_base64)),
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Parse the receipt
    result = await receipt_parser_agent.parse_receipt(
        file_content_base64=request.file_content_base64,
        file_type=request.file_type,
        file_name=request.file_name,
    )

    return result


@router.get("/supported-types")
async def get_supported_types() -> dict:
    """Get list of supported file types for upload."""
    return {
        "allowed_types": settings.allowed_file_types_list,
        "max_size_mb": settings.max_file_size_mb,
        "max_size_bytes": settings.max_file_size_bytes,
    }
