"""Receipt parser agent using LangChain."""

import base64
import time
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from api.schemas.expense import ExtractedExpense, ExpenseParseResponse
from graphs.expense_workflow import create_expense_workflow, ExpenseWorkflowState


class ReceiptParserAgent:
    """Agent for parsing expense receipts using LLM with vision capabilities."""

    def __init__(self):
        """Initialize the receipt parser agent."""
        self.workflow = create_expense_workflow()

    async def parse_receipt(
        self,
        file_content_base64: str,
        file_type: str,
        file_name: str,
    ) -> ExpenseParseResponse:
        """
        Parse a receipt and extract expense information.

        Args:
            file_content_base64: Base64-encoded file content
            file_type: MIME type of the file
            file_name: Original file name

        Returns:
            ExpenseParseResponse with extracted data or error
        """
        start_time = time.time()

        # Initialize workflow state
        initial_state: ExpenseWorkflowState = {
            "file_content_base64": file_content_base64,
            "file_type": file_type,
            "file_name": file_name,
            "raw_text": None,
            "extracted_data": None,
            "extracted_receipts": None,
            "category": None,
            "hotel_itemization": None,
            "expense": None,
            "expenses": None,
            "validation_errors": [],
            "validation_warnings": [],
            "confidence_score": 0.0,
            "processing_stage": "started",
            "error": None,
        }

        try:
            # Run the workflow
            final_state = self.workflow.invoke(initial_state)

            processing_time = int((time.time() - start_time) * 1000)

            if final_state.get("error"):
                return ExpenseParseResponse(
                    success=False,
                    expense=None,
                    expenses=[],
                    raw_text=final_state.get("raw_text"),
                    error_message=final_state["error"],
                    processing_time_ms=processing_time,
                )

            # Get expenses list (new) and single expense (backward compatibility)
            expenses = final_state.get("expenses", [])
            expense = final_state.get("expense")

            # Ensure backward compatibility - if expenses list exists but expense is None
            if expenses and not expense:
                expense = expenses[0]

            return ExpenseParseResponse(
                success=True,
                expense=expense,
                expenses=expenses,
                raw_text=final_state.get("raw_text"),
                error_message=None,
                processing_time_ms=processing_time,
            )

        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            return ExpenseParseResponse(
                success=False,
                expense=None,
                expenses=[],
                raw_text=None,
                error_message=f"Workflow execution failed: {str(e)}",
                processing_time_ms=processing_time,
            )

    def validate_file(self, file_type: str, file_size: int) -> tuple[bool, str | None]:
        """
        Validate uploaded file.

        Args:
            file_type: MIME type of the file
            file_size: Size of the file in bytes

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file type
        if file_type not in settings.allowed_file_types_list:
            return False, f"File type {file_type} not allowed. Allowed types: {settings.allowed_file_types}"

        # Check file size
        if file_size > settings.max_file_size_bytes:
            return False, f"File size exceeds maximum of {settings.max_file_size_mb}MB"

        return True, None


# Singleton instance
receipt_parser_agent = ReceiptParserAgent()
