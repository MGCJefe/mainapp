# ClipCraft - AI-Powered Video Processing

ClipCraft is a self-hosted local web application that runs on macOS, processes videos using local AI models, and provides a simple and intuitive UI.

## Features

- **Upload Videos**: Easily upload videos to process with AI
- **AI Processing**: Run tasks like transcription, frame extraction, and content generation
- **Local Processing**: All processing happens on your machine, keeping your data private
- **Modern UI**: Clean, responsive web interface accessible via localhost

## Architecture

- **Frontend**: Next.js React application
- **Backend**: FastAPI Python API
- **Processing**: Celery tasks with Redis queue
- **AI Models**: Whisper, GPT/Llama, Stable Diffusion (to be implemented)

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- Redis (for task queue)
- macOS (primary platform, other OS support may vary)

### Installation

1. Clone this repository
2. Run the start script to set up everything:

```bash
chmod +x start_app.sh
./start_app.sh
```

This will:
- Set up the Python virtual environment
- Install required dependencies
- Start both frontend and backend servers

### Accessing the Application

Once started, access the application at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs

## Project Structure

```
clip-craft/
├── src/               # Frontend React application
├── backend/           # FastAPI backend application
├── start_app.sh       # Script to start all services
└── README.md          # This file
```

## Development

To run just the frontend:

```bash
npm run dev
```

To run just the backend:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

## Implementation Status

- ✅ Frontend UI setup
- ✅ Backend API foundation
- ✅ Services communication
- 🔄 Video upload implementation (upcoming)
- 🔄 AI model integration (upcoming)
- 🔄 Results management (upcoming)
# mainapp
