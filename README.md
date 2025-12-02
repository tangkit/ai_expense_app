# AI Expense Claim Assistant

An intelligent expense-claim chatbot application with a React frontend and Python/LangGraph backend. The system enables users to upload receipts and invoices for business-trip expenses and automatically parses, identifies, and extracts key information using AI-powered vision and OCR.

## Features

- **Receipt Upload**: Drag-and-drop support for images (JPG, PNG) and PDF documents
- **AI-Powered Extraction**: Uses Claude or GPT-4 Vision to extract vendor, amount, date, and category
- **LangGraph Workflow**: Multi-step agent workflow for intelligent document processing
- **Expense Categories**: Taxi, rideshare, hotel, flight, meals, parking, toll, car rental, fuel, and more
- **Hotel Itemization**: Per-night breakdown with room rate, taxes, service charges, and fees
- **Meal Compliance**: Captures companion information for meals exceeding $25
- **Spreadsheet Export**: Generates Excel reports matching company expense templates

## Project Structure

```
ai_expense_app/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # State management
│   │   ├── services/       # API client & business logic
│   │   └── constants/      # Configuration
│   ├── package.json
│   └── vite.config.js
│
├── backend/                # Python FastAPI + LangGraph
│   ├── api/
│   │   ├── routes/         # API endpoints
│   │   └── schemas/        # Pydantic models
│   ├── agents/             # LangChain agents
│   ├── graphs/             # LangGraph workflows
│   ├── prompts/            # LLM prompt templates
│   ├── main.py             # FastAPI application
│   ├── config.py           # Configuration
│   └── requirements.txt
│
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Anthropic API key (for Claude) or OpenAI API key (for GPT-4)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

5. Edit `.env` and add your API key:
   ```env
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=your-api-key-here
   ```

6. Start the backend server:
   ```bash
   python main.py
   # Or with uvicorn:
   uvicorn main:app --reload --port 8000
   ```

7. Access the API documentation at: http://localhost:8000/docs

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure the backend URL in `.env`:
   ```env
   VITE_API_URL=http://localhost:8000/api/v1
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:5173 in your browser

## API Endpoints

### Receipt Processing
- `POST /api/v1/receipts/parse` - Upload and parse a receipt (multipart form)
- `POST /api/v1/receipts/parse-base64` - Parse a base64-encoded receipt
- `GET /api/v1/receipts/supported-types` - Get supported file types

### Expense Management
- `POST /api/v1/expenses/validate` - Validate expense data
- `POST /api/v1/expenses/export` - Export expenses to Excel/CSV
- `GET /api/v1/expenses/categories` - Get available categories
- `GET /api/v1/expenses/business-rules` - Get business rules

## LangGraph Workflow

The backend uses LangGraph to orchestrate a multi-step expense processing workflow:

```
┌─────────────────┐
│  Parse Receipt  │  ← Vision AI extracts text and fields
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Categorize    │  ← Classify expense type
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Itemize Hotel   │  ← Per-night breakdown (if hotel)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Validate     │  ← Check compliance rules
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Build Output   │  ← Structure final response
└─────────────────┘
```

## Special Handling

### Hotel Receipts
The system itemizes hotel stays on a per-day basis, recording:
- Nightly room rate
- Applicable taxes
- Service charges
- Resort/amenity fees
- Parking fees
- Other itemized charges

### Meals Over $25
For compliance and audit purposes, meals exceeding $25 require:
- Companion/customer name
- Business purpose
- Number of attendees (optional)
- Discussion topics (optional)

## Tech Stack

### Frontend
- React 19
- Vite
- date-fns
- xlsx (for Excel export)
- react-dropzone
- lucide-react (icons)

### Backend
- FastAPI
- LangChain
- LangGraph
- Anthropic Claude / OpenAI GPT-4
- Pydantic
- openpyxl (Excel generation)

## Environment Variables

### Backend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | AI provider (`anthropic` or `openai`) | `anthropic` |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_MODEL` | Claude model to use | `claude-sonnet-4-20250514` |
| `OPENAI_MODEL` | GPT model to use | `gpt-4o` |
| `PORT` | Server port | `8000` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |
| `MEAL_COMPANION_THRESHOLD` | Meal amount requiring companion info | `25.0` |

### Frontend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000/api/v1` |

## License

MIT
