# AI Expense Claim Assistant

An intelligent expense-claim chatbot application built with React. The system enables users to upload receipts and invoices for business-trip expenses and automatically parses, identifies, and extracts key information using AI-based field recognition.

## Features

- **Receipt Upload**: Drag-and-drop support for images (JPG, PNG) and PDF documents
- **AI-Powered Extraction**: Automatically detects vendor, amount, date, and expense category
- **Expense Categories**: Taxi, rideshare, hotel, flight, meals, parking, toll, car rental, fuel, and more
- **Hotel Itemization**: Per-night breakdown with room rate, taxes, service charges, and fees
- **Meal Compliance**: Captures companion information for meals exceeding $25
- **Spreadsheet Export**: Generates Excel reports matching company expense templates

## Project Structure

```
ai_expense_app/
├── frontend/           # React application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── context/    # State management
│   │   ├── services/   # Business logic
│   │   └── constants/  # Configuration
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
cd frontend
npm run dev
```

### Build

```bash
cd frontend
npm run build
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

- React 19
- Vite
- date-fns
- xlsx (for Excel export)
- react-dropzone
- lucide-react (icons)
