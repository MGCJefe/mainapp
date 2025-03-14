# ClipCraft Backend API

This is the FastAPI backend for the ClipCraft application. It provides API endpoints for video processing, including AI-based transcription, frame extraction, and other video analysis tasks.

## Features

- REST API with FastAPI
- Asynchronous task processing with Celery and Redis
- Local file storage for uploaded videos and processing results
- AI model integration (upcoming)

## Setup

### Requirements

- Python 3.9+
- Node.js 18+
- Redis (for Celery task queue)

### Installation

1. Create a Python virtual environment:
   ```bash
   cd backend
   python -m venv venv
   ```

2. Activate the virtual environment:
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Backend

You can run the backend API server directly with:

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or use the provided start script from the project root, which will start both the frontend and backend:

```bash
./start_app.sh
```

## API Documentation

Once the server is running, you can access the interactive API documentation at:

- OpenAPI UI: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

## Directory Structure

```
backend/
├── app/
│   ├── routers/       # API route handlers
│   ├── core/          # Core application code
│   └── main.py        # FastAPI application entry point
├── uploads/           # Directory for uploaded video files
├── results/           # Directory for processing results
├── requirements.txt   # Python dependencies
└── README.md          # This file
```

## Development

To run the development server with hot-reloading:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- More endpoints coming soon as we implement features 