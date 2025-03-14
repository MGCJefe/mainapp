from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import logging

from app.core.config import settings
from app.core.error_handlers import register_exception_handlers
from app.routers import health, videos, frames

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

# Register exception handlers
register_exception_handlers(app)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["health"])
app.include_router(videos.router, prefix=f"{settings.API_V1_STR}/videos", tags=["videos"])
app.include_router(frames.router, prefix=f"{settings.API_V1_STR}/frames", tags=["frames"])

# Mount static file directories for uploads and results
upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), settings.UPLOAD_DIR)
results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), settings.RESULTS_DIR)

# Create directories if they don't exist
os.makedirs(upload_dir, exist_ok=True)
os.makedirs(results_dir, exist_ok=True)

# Create subdirectories
videos_dir = os.path.join(upload_dir, "videos")
frames_dir = os.path.join(results_dir, "frames")
os.makedirs(videos_dir, exist_ok=True)
os.makedirs(frames_dir, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")
app.mount("/results", StaticFiles(directory=results_dir), name="results")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": f"{settings.API_V1_STR}/docs",
    }

@app.on_event("startup")
async def startup_event():
    logger.info(f"{settings.PROJECT_NAME} API starting up...")
    logger.info(f"Maximum upload size: {settings.MAX_UPLOAD_SIZE / (1024 * 1024 * 1024):.1f} GB")
    logger.info(f"Frame extraction enabled with sample rates: {settings.FRAME_EXTRACTION.AVAILABLE_FRAME_RATES}")
    
    # Log directory paths for debugging
    logger.info(f"Upload directory: {upload_dir}")
    logger.info(f"Videos directory: {os.path.join(upload_dir, 'videos')}")
    logger.info(f"Results directory: {results_dir}")
    logger.info(f"Frames directory: {os.path.join(results_dir, 'frames')}")
    
    # Check directory existence and permissions
    for dir_path in [upload_dir, os.path.join(upload_dir, 'videos'), 
                     results_dir, os.path.join(results_dir, 'frames')]:
        if os.path.exists(dir_path):
            logger.info(f"Directory exists: {dir_path}")
            if os.access(dir_path, os.W_OK):
                logger.info(f"Directory is writable: {dir_path}")
            else:
                logger.warning(f"Directory is not writable: {dir_path}")
        else:
            logger.warning(f"Directory does not exist: {dir_path}")
    
    # Check if frame_analyzer is available
    try:
        from app.services.frame_extraction.analyzer import FrameAnalyzer
        logger.info("Frame analyzer is available")
    except ImportError as e:
        logger.error(f"Failed to import frame analyzer: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info(f"{settings.PROJECT_NAME} API shutting down...") 