"""API routes initialization."""

from fastapi import APIRouter

from .receipts import router as receipts_router
from .expenses import router as expenses_router

router = APIRouter()
router.include_router(receipts_router, prefix="/receipts", tags=["receipts"])
router.include_router(expenses_router, prefix="/expenses", tags=["expenses"])

__all__ = ["router"]
