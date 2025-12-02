"""FastAPI application entry point for the Expense Claim Backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from api import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print(f"Starting Expense Claim API server...")
    print(f"LLM Provider: {settings.llm_provider}")
    print(f"Debug mode: {settings.debug}")
    yield
    # Shutdown
    print("Shutting down Expense Claim API server...")


app = FastAPI(
    title="Expense Claim Assistant API",
    description="""
    AI-powered backend for intelligent expense receipt processing.

    ## Features
    - **Receipt Parsing**: Upload receipts and extract expense data using AI vision
    - **Automatic Categorization**: Intelligent expense categorization
    - **Hotel Itemization**: Per-night breakdown for hotel stays
    - **Compliance Checks**: Companion tracking for meals over $25
    - **Export**: Generate Excel/CSV reports

    ## Supported File Types
    - Images: JPEG, PNG, WebP
    - Documents: PDF

    ## AI Providers
    Supports both Anthropic (Claude) and OpenAI (GPT-4) for vision processing.
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Expense Claim Assistant API",
        "version": "1.0.0",
        "docs_url": "/docs",
        "openapi_url": "/openapi.json",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "llm_provider": settings.llm_provider,
        "llm_configured": bool(
            settings.anthropic_api_key if settings.llm_provider == "anthropic"
            else settings.openai_api_key
        ),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
