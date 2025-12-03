"""Currency conversion API routes."""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional

router = APIRouter()

# Fallback exchange rates to SGD (approximate)
FALLBACK_RATES = {
    'MYR': 0.29,    # 1 MYR ≈ 0.29 SGD
    'USD': 1.35,    # 1 USD ≈ 1.35 SGD
    'EUR': 1.45,    # 1 EUR ≈ 1.45 SGD
    'GBP': 1.70,    # 1 GBP ≈ 1.70 SGD
    'JPY': 0.009,   # 1 JPY ≈ 0.009 SGD
    'CNY': 0.19,    # 1 CNY ≈ 0.19 SGD
    'THB': 0.039,   # 1 THB ≈ 0.039 SGD
    'IDR': 0.000085, # 1 IDR ≈ 0.000085 SGD
    'PHP': 0.024,   # 1 PHP ≈ 0.024 SGD
    'VND': 0.000054, # 1 VND ≈ 0.000054 SGD
    'KRW': 0.00098, # 1 KRW ≈ 0.00098 SGD
    'INR': 0.016,   # 1 INR ≈ 0.016 SGD
    'AUD': 0.88,    # 1 AUD ≈ 0.88 SGD
    'NZD': 0.81,    # 1 NZD ≈ 0.81 SGD
    'HKD': 0.17,    # 1 HKD ≈ 0.17 SGD
    'TWD': 0.042,   # 1 TWD ≈ 0.042 SGD
    'SGD': 1.0,     # No conversion needed
}


class ExchangeRateRequest(BaseModel):
    from_currency: str
    to_currency: str = "SGD"


class ExchangeRateResponse(BaseModel):
    from_currency: str
    to_currency: str
    rate: float
    source: str  # "api" or "fallback"


class BulkExchangeRateRequest(BaseModel):
    currencies: list[str]
    to_currency: str = "SGD"


class BulkExchangeRateResponse(BaseModel):
    rates: Dict[str, float]
    source: str


@router.get("/rate/{from_currency}")
async def get_exchange_rate(from_currency: str, to_currency: str = "SGD") -> ExchangeRateResponse:
    """Get exchange rate from one currency to another (default: SGD)."""
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    # If same currency, return 1
    if from_currency == to_currency:
        return ExchangeRateResponse(
            from_currency=from_currency,
            to_currency=to_currency,
            rate=1.0,
            source="direct"
        )

    # Try Alpha Vantage API
    api_key = os.getenv("ALPHAVANTAGE_API_KEY")

    if api_key and api_key != "your-alphavantage-api-key-here":
        try:
            async with httpx.AsyncClient() as client:
                url = f"https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency={from_currency}&to_currency={to_currency}&apikey={api_key}"
                response = await client.get(url, timeout=10.0)
                data = response.json()

                if "Realtime Currency Exchange Rate" in data:
                    rate = float(data["Realtime Currency Exchange Rate"]["5. Exchange Rate"])
                    return ExchangeRateResponse(
                        from_currency=from_currency,
                        to_currency=to_currency,
                        rate=rate,
                        source="api"
                    )
        except Exception as e:
            print(f"Alpha Vantage API error: {e}")

    # Use fallback rate
    if from_currency in FALLBACK_RATES:
        return ExchangeRateResponse(
            from_currency=from_currency,
            to_currency=to_currency,
            rate=FALLBACK_RATES[from_currency],
            source="fallback"
        )

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported currency: {from_currency}"
    )


@router.post("/rates/bulk")
async def get_bulk_exchange_rates(request: BulkExchangeRateRequest) -> BulkExchangeRateResponse:
    """Get exchange rates for multiple currencies at once."""
    rates = {}
    source = "fallback"

    api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    use_api = api_key and api_key != "your-alphavantage-api-key-here"

    for currency in request.currencies:
        currency = currency.upper()

        if currency == request.to_currency.upper():
            rates[currency] = 1.0
            continue

        if use_api:
            try:
                async with httpx.AsyncClient() as client:
                    url = f"https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency={currency}&to_currency={request.to_currency}&apikey={api_key}"
                    response = await client.get(url, timeout=10.0)
                    data = response.json()

                    if "Realtime Currency Exchange Rate" in data:
                        rates[currency] = float(data["Realtime Currency Exchange Rate"]["5. Exchange Rate"])
                        source = "api"
                        continue
            except Exception as e:
                print(f"Alpha Vantage API error for {currency}: {e}")

        # Use fallback
        if currency in FALLBACK_RATES:
            rates[currency] = FALLBACK_RATES[currency]
        else:
            rates[currency] = 1.0  # Default to 1 if unknown

    return BulkExchangeRateResponse(rates=rates, source=source)
