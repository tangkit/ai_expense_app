"""LangGraph workflow for expense receipt processing."""
from __future__ import annotations

import json
import base64
import asyncio
import io
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, TypedDict, Literal, Any, TYPE_CHECKING

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from PIL import Image

from config import settings
from services.exchange_rate import exchange_rate_service
from prompts.templates import (
    RECEIPT_EXTRACTION_PROMPT,
    HOTEL_ITEMIZATION_PROMPT,
    VALIDATION_PROMPT,
    RECEIPT_PARSER_SYSTEM,
    HOTEL_SPECIALIST_SYSTEM,
    VALIDATOR_SYSTEM,
)

# Import schemas only for type checking to avoid circular imports
if TYPE_CHECKING:
    from api.schemas.expense import (
        ExpenseCategory,
        ExtractedExpense,
        HotelNightItem,
        MealCompanionInfo,
    )


def get_llm(provider: str = None):
    """Get the configured LLM instance.

    Args:
        provider: Force a specific provider ('anthropic' or 'openai').
                  If None, uses the configured default.
    """
    use_provider = provider or settings.llm_provider

    if use_provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            max_tokens=4096,
        )
    else:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            max_tokens=4096,
        )


def get_llm_with_fallback():
    """Get LLM with automatic fallback support.

    Tries the primary provider first, falls back to secondary if primary fails.
    Returns tuple of (llm, provider_name).
    """
    primary = settings.llm_provider
    secondary = "openai" if primary == "anthropic" else "anthropic"

    # Check if we have keys for fallback
    has_anthropic = bool(settings.anthropic_api_key)
    has_openai = bool(settings.openai_api_key)

    return get_llm(primary), primary, secondary if (has_anthropic and has_openai) else None


class ExpenseWorkflowState(TypedDict):
    """State for the expense processing workflow."""

    # Input
    file_content_base64: str
    file_type: str
    file_name: str

    # Processing stages
    raw_text: str | None
    extracted_data: dict | None  # Legacy single receipt (kept for compatibility)
    extracted_receipts: list[dict] | None  # Multiple receipts from document
    category: str | None
    hotel_itemization: list[dict] | None

    # Currency conversion
    original_currency: str | None
    original_amount: Decimal | None
    exchange_rate: Decimal | None
    exchange_rate_source: str | None
    exchange_rate_date: date | None
    converted_amount: Decimal | None

    # Output (using Any to avoid circular import issues with LangGraph)
    expense: Any  # ExtractedExpense | None - Legacy single expense
    expenses: list[Any] | None  # list[ExtractedExpense] - Multiple expenses from document
    validation_errors: list[str]
    validation_warnings: list[str]

    # Metadata
    confidence_score: float
    processing_stage: str
    error: str | None


def parse_receipt(state: ExpenseWorkflowState) -> ExpenseWorkflowState:
    """Parse the receipt using vision LLM with automatic fallback."""
    import logging
    logger = logging.getLogger(__name__)

    file_content = state["file_content_base64"]
    file_type = state["file_type"]
    file_name = state.get("file_name", "document")

    # Build the message with image/document content
    if file_type.startswith("image/"):
        # For images, use vision capabilities
        content = [
            {"type": "text", "text": RECEIPT_EXTRACTION_PROMPT.format(receipt_content="[See attached image]")},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{file_type};base64,{file_content}"},
            },
        ]
    elif file_type == "application/pdf":
        # Convert PDF to images using pdf2image for LangChain compatibility
        try:
            from pdf2image import convert_from_bytes

            # Decode base64 PDF
            pdf_bytes = base64.b64decode(file_content)

            # Convert PDF pages to images
            images = convert_from_bytes(pdf_bytes, dpi=150, first_page=1, last_page=3)  # First 3 pages max

            # Build content with all pages as images
            content = [
                {"type": "text", "text": RECEIPT_EXTRACTION_PROMPT.format(
                    receipt_content=f"[PDF document: {file_name} - {len(images)} page(s) converted to images]"
                )}
            ]

            for idx, img in enumerate(images):
                # Convert PIL image to base64 PNG
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{img_base64}"},
                })

        except ImportError:
            # pdf2image not available, try sending as-is
            content = [
                {"type": "text", "text": RECEIPT_EXTRACTION_PROMPT.format(
                    receipt_content=f"[PDF document: {file_name} - Unable to convert, please extract text]"
                )},
            ]
        except Exception as e:
            # PDF conversion failed
            content = [
                {"type": "text", "text": RECEIPT_EXTRACTION_PROMPT.format(
                    receipt_content=f"[PDF document: {file_name} - Conversion error: {str(e)}]"
                )},
            ]
    else:
        # For other types, just describe it
        content = [
            {
                "type": "text",
                "text": RECEIPT_EXTRACTION_PROMPT.format(
                    receipt_content=f"[Document: {file_name}, type: {file_type}]"
                ),
            }
        ]

    messages = [
        SystemMessage(content=RECEIPT_PARSER_SYSTEM),
        HumanMessage(content=content),
    ]

    # Try primary provider, fallback to secondary if it fails
    primary_llm, primary_provider, fallback_provider = get_llm_with_fallback()
    providers_to_try = [(primary_llm, primary_provider)]

    if fallback_provider:
        providers_to_try.append((get_llm(fallback_provider), fallback_provider))

    last_error = None
    for llm, provider_name in providers_to_try:
        try:
            logger.info(f"Attempting receipt parsing with {provider_name}...")
            print(f"[PARSE] Trying {provider_name}...")

            response = llm.invoke(messages)
            response_text = response.content

            # Extract JSON from response
            extracted_data = extract_json_from_response(response_text)

            if extracted_data:
                state["raw_text"] = response_text
                state["confidence_score"] = 0.85

                # Handle new multi-receipt format
                if "receipts" in extracted_data and isinstance(extracted_data["receipts"], list):
                    receipts = extracted_data["receipts"]
                    state["extracted_receipts"] = receipts
                    # For backward compatibility, also set extracted_data to first receipt
                    if receipts:
                        state["extracted_data"] = receipts[0]
                        state["category"] = receipts[0].get("category", "other")
                else:
                    # Legacy single receipt format - wrap in array
                    state["extracted_receipts"] = [extracted_data]
                    state["extracted_data"] = extracted_data
                    state["category"] = extracted_data.get("category", "other")

                state["processing_stage"] = "parsed"
                logger.info(f"Receipt parsed successfully with {provider_name}")
                print(f"[PARSE] Success with {provider_name}")
                return state
            else:
                last_error = "Failed to extract structured data from receipt"

        except Exception as e:
            error_str = str(e)
            last_error = error_str
            logger.warning(f"{provider_name} failed: {error_str}")
            print(f"[PARSE] {provider_name} failed: {error_str[:100]}...")

            # Check if this is an authentication/API error that warrants fallback
            is_auth_error = any(code in error_str for code in ["401", "403", "invalid_api_key", "authentication"])
            is_rate_limit = "429" in error_str or "rate_limit" in error_str.lower()
            is_server_error = any(code in error_str for code in ["500", "502", "503", "504"])

            if is_auth_error or is_rate_limit or is_server_error:
                logger.info(f"Fallback triggered due to {provider_name} error, trying next provider...")
                print(f"[PARSE] Fallback triggered, trying next provider...")
                continue
            else:
                # Other errors - don't fallback, just fail
                break

    # All providers failed
    state["error"] = f"Receipt parsing failed: {last_error}"
    state["processing_stage"] = "error"
    return state


def extract_json_from_response(text: str) -> dict | None:
    """Extract JSON object from LLM response text."""
    # Try to find JSON in the response
    try:
        # First, try direct parsing
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in markdown
    import re

    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find raw JSON object
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def categorize_expense(state: ExpenseWorkflowState) -> ExpenseWorkflowState:
    """Verify and potentially correct the expense category."""
    # Import at runtime to avoid circular imports
    from api.schemas.expense import ExpenseCategory

    if state.get("error"):
        return state

    extracted = state.get("extracted_data", {})
    vendor = extracted.get("vendor", "")
    category = extracted.get("category", "other")

    # Validate category is one of our known categories
    valid_categories = [c.value for c in ExpenseCategory]
    if category not in valid_categories:
        category = "other"

    state["category"] = category
    state["processing_stage"] = "categorized"

    return state


def itemize_hotel(state: ExpenseWorkflowState) -> ExpenseWorkflowState:
    """Generate per-night itemization for hotel receipts with LLM fallback."""
    if state.get("error"):
        return state

    if state.get("category") != "hotel":
        state["processing_stage"] = "itemized"
        return state

    extracted = state.get("extracted_data", {})

    # Check if itemization already exists
    if extracted.get("hotel_nights"):
        state["hotel_itemization"] = extracted["hotel_nights"]
        state["processing_stage"] = "itemized"
        return state

    # Generate itemization using LLM
    check_in = extracted.get("check_in_date")
    check_out = extracted.get("check_out_date")
    total = extracted.get("total", 0)

    if not check_in or not check_out:
        # Try to infer from expense date and calculate single night
        expense_date = extracted.get("expense_date", str(date.today()))
        state["hotel_itemization"] = [
            {
                "night_date": expense_date,
                "room_rate": float(total) * 0.85,  # Estimate 85% base rate
                "room_tax": float(total) * 0.12,  # Estimate 12% tax
                "service_charge": float(total) * 0.03,  # Estimate 3% service
                "resort_fee": 0,
                "parking_fee": 0,
                "other_fees": 0,
            }
        ]
        state["processing_stage"] = "itemized"
        return state

    prompt = HOTEL_ITEMIZATION_PROMPT.format(
        receipt_content=state.get("raw_text", ""),
        check_in_date=check_in,
        check_out_date=check_out,
        total_amount=total,
    )

    messages = [
        SystemMessage(content=HOTEL_SPECIALIST_SYSTEM),
        HumanMessage(content=prompt),
    ]

    # Try with fallback support
    primary_llm, primary_provider, fallback_provider = get_llm_with_fallback()
    providers_to_try = [(primary_llm, primary_provider)]
    if fallback_provider:
        providers_to_try.append((get_llm(fallback_provider), fallback_provider))

    for llm, provider_name in providers_to_try:
        try:
            print(f"[HOTEL] Trying {provider_name} for itemization...")
            response = llm.invoke(messages)
            itemization = extract_json_from_response(response.content)

            if itemization and isinstance(itemization, list):
                state["hotel_itemization"] = itemization
                print(f"[HOTEL] Success with {provider_name}")
                state["processing_stage"] = "itemized"
                return state
        except Exception as e:
            error_str = str(e)
            print(f"[HOTEL] {provider_name} failed: {error_str[:100]}...")
            # Check if fallback should be triggered
            is_fallback_error = any(code in error_str for code in ["401", "403", "429", "500", "502", "503", "504"])
            if is_fallback_error:
                continue
            break

    # All providers failed - use default itemization
    print("[HOTEL] Using default itemization")
    state["hotel_itemization"] = generate_default_hotel_itemization(
        check_in, check_out, float(total)
    )
    state["processing_stage"] = "itemized"
    return state


def generate_default_hotel_itemization(
    check_in: str, check_out: str, total: float
) -> list[dict]:
    """Generate default per-night hotel itemization."""
    from datetime import datetime, timedelta

    check_in_date = datetime.strptime(check_in, "%Y-%m-%d").date()
    check_out_date = datetime.strptime(check_out, "%Y-%m-%d").date()
    nights = (check_out_date - check_in_date).days

    if nights <= 0:
        nights = 1

    # Calculate per-night amounts
    base_rate = total / nights / 1.15  # Assume 15% for taxes/fees
    tax_rate = base_rate * 0.12
    service = base_rate * 0.03

    items = []
    for i in range(nights):
        night_date = check_in_date + timedelta(days=i)
        items.append(
            {
                "night_date": night_date.isoformat(),
                "room_rate": round(base_rate, 2),
                "room_tax": round(tax_rate, 2),
                "service_charge": round(service, 2),
                "resort_fee": 0,
                "parking_fee": 0,
                "other_fees": 0,
            }
        )

    return items


def validate_expense(state: ExpenseWorkflowState) -> ExpenseWorkflowState:
    """Validate the extracted expense data."""
    if state.get("error"):
        return state

    extracted = state.get("extracted_data", {})
    errors = []
    warnings = []

    # Required field validation
    if not extracted.get("vendor"):
        errors.append("Vendor name is required")

    if not extracted.get("total") or float(extracted.get("total", 0)) <= 0:
        errors.append("Total amount must be greater than 0")

    if not extracted.get("expense_date"):
        warnings.append("Expense date not detected, using today's date")
        extracted["expense_date"] = str(date.today())

    # Category-specific validation
    category = state.get("category", "other")

    if category == "meal":
        total = float(extracted.get("total", 0))
        if total > settings.meal_companion_threshold:
            warnings.append(
                f"Meal exceeds ${settings.meal_companion_threshold} - companion information required"
            )
            extracted["requires_companion"] = True

    if category == "hotel":
        if not state.get("hotel_itemization"):
            warnings.append("Hotel itemization required for per-night breakdown")
            extracted["requires_itemization"] = True

    state["validation_errors"] = errors
    state["validation_warnings"] = warnings
    state["extracted_data"] = extracted
    state["processing_stage"] = "validated"

    return state


def normalize_currency_code(currency: str) -> str:
    """Normalize various currency representations to standard ISO codes."""
    if not currency:
        return "USD"

    currency_upper = currency.upper().strip()

    # Map common representations to ISO codes
    currency_map = {
        "RM": "MYR",
        "RINGGIT": "MYR",
        "MALAYSIAN RINGGIT": "MYR",
        "S$": "SGD",
        "SINGAPORE DOLLAR": "SGD",
        "BAHT": "THB",
        "THAI BAHT": "THB",
        "฿": "THB",
        "RUPIAH": "IDR",
        "INDONESIAN RUPIAH": "IDR",
        "IDR": "IDR",
        "RP": "IDR",
        "€": "EUR",
        "EURO": "EUR",
        "£": "GBP",
        "POUND": "GBP",
        "¥": "JPY",
        "YEN": "JPY",
        "$": "USD",  # Default $ to USD, but this could be ambiguous
    }

    # Check if it's already a valid ISO code
    valid_codes = ["USD", "MYR", "SGD", "THB", "IDR", "EUR", "GBP", "JPY", "AUD", "CAD", "HKD", "PHP", "VND", "INR", "CNY"]
    if currency_upper in valid_codes:
        return currency_upper

    # Try to map from common representations
    return currency_map.get(currency_upper, currency_upper)


def infer_currency_from_airline(airline: str, departure_city: str = None) -> str | None:
    """Infer currency based on airline name or departure city."""
    if not airline:
        return None

    airline_lower = airline.lower()

    # Malaysian airlines
    if any(x in airline_lower for x in ["batik air", "airasia", "malaysia airlines", "firefly", "malindo"]):
        return "MYR"

    # Singapore airlines
    if any(x in airline_lower for x in ["singapore airlines", "scoot", "silkair", "jetstar asia"]):
        return "SGD"

    # Thai airlines
    if any(x in airline_lower for x in ["thai airways", "bangkok airways", "thai airasia", "nok air"]):
        return "THB"

    # Indonesian airlines
    if any(x in airline_lower for x in ["garuda", "lion air", "citilink", "batik air indonesia"]):
        return "IDR"

    # Check departure city for Malaysian airports
    if departure_city:
        departure_lower = departure_city.lower()
        if any(x in departure_lower for x in ["kuala lumpur", "kul", "penang", "pen", "kota kinabalu", "bki", "johor", "langkawi", "malaysia"]):
            return "MYR"

    return None


def convert_currency(state: ExpenseWorkflowState) -> ExpenseWorkflowState:
    """Convert foreign currency to reimbursement currency using exchange rates."""
    import logging
    logger = logging.getLogger(__name__)

    if state.get("error"):
        return state

    extracted = state.get("extracted_data", {})
    raw_currency = extracted.get("currency", "USD")
    # Normalize the currency code (handles RM -> MYR, Ringgit -> MYR, etc.)
    currency = normalize_currency_code(raw_currency)
    total = Decimal(str(extracted.get("total", 0)))
    reimbursement_currency = settings.reimbursement_currency.upper()

    logger.info(f"Currency conversion: raw={raw_currency}, normalized={currency}, airline={extracted.get('airline')}, departure={extracted.get('departure_city')}")
    print(f"[CURRENCY] Raw: {raw_currency}, Normalized: {currency}, Airline: {extracted.get('airline')}, Departure: {extracted.get('departure_city')}")

    # If currency is USD but we have airline info, try to infer the actual currency
    # (LLM may default to USD when it can't detect the currency symbol)
    if currency == "USD" and extracted.get("airline"):
        inferred_currency = infer_currency_from_airline(
            extracted.get("airline", ""),
            extracted.get("departure_city", "")
        )
        if inferred_currency:
            print(f"[CURRENCY] Inferred {inferred_currency} from airline {extracted.get('airline')}")
            logger.info(f"Inferred currency {inferred_currency} from airline")
            currency = inferred_currency
            extracted["currency"] = currency
            state["extracted_data"] = extracted
        else:
            print(f"[CURRENCY] Could not infer currency from airline {extracted.get('airline')}")
    elif currency != raw_currency.upper():
        # Currency was normalized from a different representation
        print(f"[CURRENCY] Normalized currency from '{raw_currency}' to '{currency}'")
        extracted["currency"] = currency
        state["extracted_data"] = extracted
    else:
        print(f"[CURRENCY] Using detected currency: {currency}")

    # Store original currency info
    state["original_currency"] = currency
    state["original_amount"] = total

    # Check if conversion is needed
    if currency == reimbursement_currency:
        state["exchange_rate"] = Decimal("1.0")
        state["exchange_rate_source"] = "none"
        state["exchange_rate_date"] = date.today()
        state["converted_amount"] = total
        state["processing_stage"] = "currency_converted"
        return state

    # Get expense date for historical rate
    expense_date_str = extracted.get("expense_date", str(date.today()))
    try:
        if isinstance(expense_date_str, str):
            expense_date = datetime.strptime(expense_date_str, "%Y-%m-%d").date()
        else:
            expense_date = expense_date_str
    except:
        expense_date = date.today()

    # Fetch exchange rate (run async in sync context)
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        exchange_rate, source, rate_date = loop.run_until_complete(
            exchange_rate_service.get_exchange_rate(currency, reimbursement_currency, expense_date)
        )
        loop.close()

        state["exchange_rate"] = exchange_rate
        state["exchange_rate_source"] = source
        state["exchange_rate_date"] = rate_date

        # Convert amount
        converted = exchange_rate_service.convert_amount(total, exchange_rate)
        state["converted_amount"] = converted

        # Update extracted data with conversion info
        extracted["original_currency"] = currency
        extracted["original_amount"] = float(total)
        extracted["exchange_rate"] = float(exchange_rate)
        extracted["exchange_rate_source"] = source
        extracted["exchange_rate_date"] = rate_date.isoformat()

        # Update total to converted amount for reimbursement
        extracted["total"] = float(converted)
        extracted["currency"] = reimbursement_currency

        # Add warning about conversion
        warnings = state.get("validation_warnings", [])
        warnings.append(
            f"Currency converted from {currency} {total} to {reimbursement_currency} {converted} "
            f"(rate: {exchange_rate:.4f} from {source})"
        )
        state["validation_warnings"] = warnings
        state["extracted_data"] = extracted

    except Exception as e:
        # Log error but continue with original currency
        warnings = state.get("validation_warnings", [])
        warnings.append(f"Currency conversion failed: {str(e)}. Using original amounts.")
        state["validation_warnings"] = warnings

    state["processing_stage"] = "currency_converted"
    return state


def safe_decimal(value, default=0) -> Decimal:
    """Safely convert a value to Decimal, handling None/null values."""
    if value is None:
        return Decimal(str(default))
    try:
        return Decimal(str(value))
    except:
        return Decimal(str(default))


def safe_date(value, default=None, fallback_to_today=True) -> date | None:
    """Safely convert a value to date, handling None/null and invalid formats.

    Args:
        value: The value to convert to a date
        default: Default value if conversion fails
        fallback_to_today: If True and default is None, fallback to today's date.
                          If False and default is None, return None for invalid values.
    """
    if value is None:
        if default is not None:
            return default
        return date.today() if fallback_to_today else None

    # If already a date object, return it
    if isinstance(value, date):
        return value

    # If it's a string, try various formats
    if isinstance(value, str):
        value = value.strip()
        if not value:
            if default is not None:
                return default
            return date.today() if fallback_to_today else None

        # Try common date formats
        formats = [
            "%Y-%m-%d",      # 2024-01-15
            "%d/%m/%Y",      # 15/01/2024
            "%m/%d/%Y",      # 01/15/2024
            "%d-%m-%Y",      # 15-01-2024
            "%Y/%m/%d",      # 2024/01/15
            "%d %b %Y",      # 15 Jan 2024
            "%d %B %Y",      # 15 January 2024
            "%b %d, %Y",     # Jan 15, 2024
            "%B %d, %Y",     # January 15, 2024
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue

        # If all formats fail, return default or None
        if default is not None:
            return default
        return date.today() if fallback_to_today else None

    # Unknown type, return default or None
    if default is not None:
        return default
    return date.today() if fallback_to_today else None


def build_single_expense(extracted: dict, hotel_itemization: list | None, confidence_score: float):
    """Build a single ExtractedExpense from extracted data."""
    # Import schemas at runtime to avoid circular imports
    from api.schemas.expense import ExpenseCategory, ExtractedExpense, HotelNightItem

    category = extracted.get("category", "other")

    # Validate category
    valid_categories = [c.value for c in ExpenseCategory]
    if category not in valid_categories:
        category = "other"

    # Parse dates using safe_date helper
    expense_date = safe_date(extracted.get("expense_date"), date.today())

    # Get check-in date for hotel date incrementing
    check_in_date = safe_date(extracted.get("check_in_date"), expense_date) if category == "hotel" else expense_date

    # Build hotel itemization if present
    hotel_items = None
    if hotel_itemization:
        hotel_items = []
        for idx, item in enumerate(hotel_itemization):
            # Try to get the night_date, but if invalid/missing, increment from check-in date
            # Use fallback_to_today=False so invalid dates return None and trigger incrementing
            night_date = safe_date(item.get("night_date"), None, fallback_to_today=False)
            if night_date is None:
                # Increment from check-in date based on index
                night_date = check_in_date + timedelta(days=idx)
            hotel_items.append(
                HotelNightItem(
                    night_date=night_date,
                    room_rate=safe_decimal(item.get("room_rate")),
                    room_tax=safe_decimal(item.get("room_tax")),
                    service_charge=safe_decimal(item.get("service_charge")),
                    resort_fee=safe_decimal(item.get("resort_fee")),
                    parking_fee=safe_decimal(item.get("parking_fee")),
                    other_fees=safe_decimal(item.get("other_fees")),
                )
            )
    elif extracted.get("hotel_nights"):
        # Hotel nights from LLM extraction
        hotel_items = []
        for idx, item in enumerate(extracted["hotel_nights"]):
            # Try to get the night_date, but if invalid/missing, increment from check-in date
            # Use fallback_to_today=False so invalid dates return None and trigger incrementing
            night_date = safe_date(item.get("night_date"), None, fallback_to_today=False)
            if night_date is None:
                # Increment from check-in date based on index
                night_date = check_in_date + timedelta(days=idx)
            hotel_items.append(
                HotelNightItem(
                    night_date=night_date,
                    room_rate=safe_decimal(item.get("room_rate")),
                    room_tax=safe_decimal(item.get("room_tax")),
                    service_charge=safe_decimal(item.get("service_charge")),
                    resort_fee=safe_decimal(item.get("resort_fee")),
                    parking_fee=safe_decimal(item.get("parking_fee")),
                    other_fees=safe_decimal(item.get("other_fees")),
                )
            )

    # Parse check-in/check-out dates for hotels
    check_in = None
    check_out = None
    if category == "hotel":
        if extracted.get("check_in_date"):
            check_in = safe_date(extracted["check_in_date"])
        if extracted.get("check_out_date"):
            check_out = safe_date(extracted["check_out_date"])

    # Parse currency conversion dates
    exchange_rate_date = None
    if extracted.get("exchange_rate_date"):
        exchange_rate_date = safe_date(extracted["exchange_rate_date"], date.today())

    # Get subtotal, defaulting to total if not provided
    subtotal_val = extracted.get("subtotal")
    if subtotal_val is None:
        subtotal_val = extracted.get("total", 0)

    return ExtractedExpense(
        vendor=extracted.get("vendor", "Unknown"),
        category=ExpenseCategory(category),
        expense_date=expense_date,
        description=extracted.get("description"),
        subtotal=safe_decimal(subtotal_val),
        tax=safe_decimal(extracted.get("tax")),
        total=safe_decimal(extracted.get("total")),
        currency=extracted.get("currency", "USD"),
        # Currency conversion fields
        original_currency=extracted.get("original_currency"),
        original_amount=safe_decimal(extracted.get("original_amount")) if extracted.get("original_amount") is not None else None,
        exchange_rate=safe_decimal(extracted.get("exchange_rate")) if extracted.get("exchange_rate") is not None else None,
        exchange_rate_source=extracted.get("exchange_rate_source"),
        exchange_rate_date=exchange_rate_date,
        # Receipt info
        receipt_number=extracted.get("receipt_number"),
        payment_method=extracted.get("payment_method"),
        # Hotel fields
        check_in_date=check_in,
        check_out_date=check_out,
        hotel_itemization=hotel_items,
        # Flight fields
        airline=extracted.get("airline"),
        flight_number=extracted.get("flight_number"),
        departure_city=extracted.get("departure_city"),
        arrival_city=extracted.get("arrival_city"),
        passenger_name=extracted.get("passenger_name"),
        booking_reference=extracted.get("booking_reference"),
        # Metadata
        confidence_score=confidence_score,
        requires_companion=extracted.get("requires_companion", False),
        requires_itemization=extracted.get("requires_itemization", False),
    )


def build_expense_output(state: ExpenseWorkflowState) -> ExpenseWorkflowState:
    """Build the final ExtractedExpense output(s) for all receipts."""
    if state.get("error"):
        return state

    try:
        confidence_score = state.get("confidence_score", 0.8)
        expenses = []

        # Process multiple receipts if available
        receipts = state.get("extracted_receipts", [])
        if not receipts:
            # Fall back to single extracted_data for backward compatibility
            extracted = state.get("extracted_data", {})
            if extracted:
                receipts = [extracted]

        for idx, extracted in enumerate(receipts):
            # For first receipt, use state-level hotel itemization if available
            # (from itemize_hotel step)
            hotel_itemization = state.get("hotel_itemization") if idx == 0 else None

            expense = build_single_expense(extracted, hotel_itemization, confidence_score)
            expenses.append(expense)

        # Set both single expense (for backward compatibility) and expenses list
        state["expenses"] = expenses
        state["expense"] = expenses[0] if expenses else None
        state["processing_stage"] = "complete"

    except Exception as e:
        state["error"] = f"Failed to build expense output: {str(e)}"
        state["processing_stage"] = "error"

    return state


def should_itemize_hotel(state: ExpenseWorkflowState) -> Literal["itemize", "skip"]:
    """Determine if hotel itemization is needed."""
    if state.get("category") == "hotel":
        return "itemize"
    return "skip"


def create_expense_workflow() -> StateGraph:
    """Create the expense processing workflow graph."""
    workflow = StateGraph(ExpenseWorkflowState)

    # Add nodes
    workflow.add_node("parse_receipt", parse_receipt)
    workflow.add_node("categorize", categorize_expense)
    workflow.add_node("itemize_hotel", itemize_hotel)
    workflow.add_node("validate", validate_expense)
    workflow.add_node("convert_currency", convert_currency)
    workflow.add_node("build_output", build_expense_output)

    # Define edges
    workflow.set_entry_point("parse_receipt")
    workflow.add_edge("parse_receipt", "categorize")
    workflow.add_edge("categorize", "itemize_hotel")
    workflow.add_edge("itemize_hotel", "validate")
    workflow.add_edge("validate", "convert_currency")
    workflow.add_edge("convert_currency", "build_output")
    workflow.add_edge("build_output", END)

    return workflow.compile()
