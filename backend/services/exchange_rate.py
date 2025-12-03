"""Exchange rate service for currency conversion using AlphaVantage or fallback APIs."""

import httpx
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
import logging

from config import settings

logger = logging.getLogger(__name__)


class ExchangeRateService:
    """Service for fetching exchange rates from AlphaVantage and fallback providers."""

    def __init__(self):
        self.alphavantage_api_key = getattr(settings, 'alphavantage_api_key', None)
        self.base_currency = getattr(settings, 'reimbursement_currency', 'USD')
        self._cache: dict[str, tuple[Decimal, datetime]] = {}
        self._cache_duration_hours = 1

    async def get_exchange_rate(
        self,
        from_currency: str,
        to_currency: str = None,
        rate_date: date = None
    ) -> tuple[Decimal, str, date]:
        """
        Get exchange rate between two currencies.

        Args:
            from_currency: Source currency code (e.g., 'MYR')
            to_currency: Target currency code (default: reimbursement currency)
            rate_date: Date for the rate (default: today)

        Returns:
            Tuple of (exchange_rate, source, rate_date)
        """
        if to_currency is None:
            to_currency = self.base_currency

        if rate_date is None:
            rate_date = date.today()

        # Same currency, no conversion needed
        if from_currency.upper() == to_currency.upper():
            return Decimal("1.0"), "none", rate_date

        # Check cache first
        cache_key = f"{from_currency}_{to_currency}_{rate_date}"
        if cache_key in self._cache:
            rate, cached_at = self._cache[cache_key]
            if (datetime.now() - cached_at).total_seconds() < self._cache_duration_hours * 3600:
                logger.info(f"Using cached rate for {cache_key}: {rate}")
                return rate, "cached (AlphaVantage)", rate_date

        # Try AlphaVantage first if API key is available
        if self.alphavantage_api_key:
            try:
                rate = await self._fetch_alphavantage_rate(from_currency, to_currency)
                if rate:
                    self._cache[cache_key] = (rate, datetime.now())
                    return rate, "AlphaVantage", rate_date
            except Exception as e:
                logger.warning(f"AlphaVantage API failed: {e}")

        # Fallback to free API (frankfurter - ECB data)
        try:
            rate = await self._fetch_frankfurter_rate(from_currency, to_currency, rate_date)
            if rate:
                self._cache[cache_key] = (rate, datetime.now())
                return rate, "Frankfurter (ECB)", rate_date
        except Exception as e:
            logger.warning(f"Frankfurter API failed: {e}")

        # Last resort: use approximate rates
        rate = self._get_fallback_rate(from_currency, to_currency)
        return rate, "fallback (approximate)", rate_date

    async def _fetch_alphavantage_rate(
        self,
        from_currency: str,
        to_currency: str
    ) -> Optional[Decimal]:
        """Fetch real-time exchange rate from AlphaVantage API."""
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "CURRENCY_EXCHANGE_RATE",
            "from_currency": from_currency.upper(),
            "to_currency": to_currency.upper(),
            "apikey": self.alphavantage_api_key,
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                # AlphaVantage response format:
                # {"Realtime Currency Exchange Rate": {"5. Exchange Rate": "0.21234"}}
                if "Realtime Currency Exchange Rate" in data:
                    rate_data = data["Realtime Currency Exchange Rate"]
                    rate_str = rate_data.get("5. Exchange Rate")
                    if rate_str:
                        logger.info(f"AlphaVantage rate {from_currency}->{to_currency}: {rate_str}")
                        return Decimal(rate_str)
                elif "Error Message" in data:
                    logger.warning(f"AlphaVantage error: {data['Error Message']}")
                elif "Note" in data:
                    # API rate limit message
                    logger.warning(f"AlphaVantage rate limit: {data['Note']}")
        return None

    async def _fetch_frankfurter_rate(
        self,
        from_currency: str,
        to_currency: str,
        rate_date: date
    ) -> Optional[Decimal]:
        """Fetch rate from Frankfurter API (free, based on ECB data)."""
        # Use latest for today, or specific date for historical
        date_str = "latest" if rate_date == date.today() else rate_date.isoformat()
        url = f"https://api.frankfurter.app/{date_str}"
        params = {
            "from": from_currency.upper(),
            "to": to_currency.upper(),
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                rates = data.get("rates", {})
                if to_currency.upper() in rates:
                    return Decimal(str(rates[to_currency.upper()]))
        return None

    def _get_fallback_rate(self, from_currency: str, to_currency: str) -> Decimal:
        """Get approximate fallback rate when APIs fail."""
        # Approximate rates to USD (as of late 2024)
        usd_rates = {
            "MYR": Decimal("0.21"),   # 1 MYR ≈ 0.21 USD
            "SGD": Decimal("0.74"),   # 1 SGD ≈ 0.74 USD
            "THB": Decimal("0.028"),  # 1 THB ≈ 0.028 USD
            "EUR": Decimal("1.05"),   # 1 EUR ≈ 1.05 USD
            "GBP": Decimal("1.25"),   # 1 GBP ≈ 1.25 USD
            "JPY": Decimal("0.0067"), # 1 JPY ≈ 0.0067 USD
            "CNY": Decimal("0.14"),   # 1 CNY ≈ 0.14 USD
            "AUD": Decimal("0.65"),   # 1 AUD ≈ 0.65 USD
            "INR": Decimal("0.012"),  # 1 INR ≈ 0.012 USD
            "IDR": Decimal("0.000063"), # 1 IDR ≈ 0.000063 USD
            "PHP": Decimal("0.017"),  # 1 PHP ≈ 0.017 USD
            "VND": Decimal("0.00004"), # 1 VND ≈ 0.00004 USD
            "USD": Decimal("1.0"),
        }

        from_currency = from_currency.upper()
        to_currency = to_currency.upper()

        # Convert from source to USD
        if from_currency in usd_rates:
            from_to_usd = usd_rates[from_currency]
        else:
            logger.warning(f"Unknown currency: {from_currency}, using 1:1 rate")
            from_to_usd = Decimal("1.0")

        # Convert from USD to target
        if to_currency == "USD":
            return from_to_usd
        elif to_currency in usd_rates:
            # Convert via USD
            usd_to_target = Decimal("1.0") / usd_rates[to_currency]
            return from_to_usd * usd_to_target
        else:
            logger.warning(f"Unknown target currency: {to_currency}, using 1:1 rate")
            return from_to_usd

    def convert_amount(
        self,
        amount: Decimal,
        exchange_rate: Decimal
    ) -> Decimal:
        """Convert amount using exchange rate."""
        return (amount * exchange_rate).quantize(Decimal("0.01"))


# Singleton instance
exchange_rate_service = ExchangeRateService()
