from pydantic import BaseModel
from typing import List, Dict
import os

class FrameExtractionSettings(BaseModel):
    """Frame extraction configuration settings."""
    # Directory name for storing extracted frames
    FRAMES_DIR: str = "frames"
    
    # Maximum number of frames to extract per video
    MAX_FRAMES: int = 100
    
    # Available frame rates for UI selection
    AVAILABLE_FRAME_RATES: List[int] = [1, 2, 5, 10, 15, 24, 30]
    
    # Default frame rate (sample every Nth frame)
    DEFAULT_SAMPLE_RATE: int = 24
    
    # Minimum quality score for a frame to be considered
    MIN_QUALITY_SCORE: float = 30.0
    
    # Whether to use parallel processing
    USE_PARALLEL: bool = True
    
    # Maximum number of worker processes (None = auto-detect)
    MAX_WORKERS: int = None
    
    # Thumbnail size for preview (width, height)
    THUMBNAIL_SIZE: List[int] = [320, 180]
    
    # JPEG quality for thumbnails (1-100)
    THUMBNAIL_QUALITY: int = 85
    
    # Maximum frames to display in UI at once
    UI_MAX_DISPLAY_FRAMES: int = 50

class Settings(BaseModel):
    """Application settings."""
    # API configuration
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "ClipCraft"
    
    # CORS settings
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    
    # File storage
    UPLOAD_DIR: str = "uploads"
    RESULTS_DIR: str = "results"
    
    # Maximum upload size (10GB)
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024 * 1024  # 10GB in bytes
    
    # Frame extraction settings
    FRAME_EXTRACTION: FrameExtractionSettings = FrameExtractionSettings()

# Create required directories if they don't exist
def create_directories():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    
    dirs = [
        os.path.join(base_dir, Settings().UPLOAD_DIR),
        os.path.join(base_dir, Settings().UPLOAD_DIR, "videos"),
        os.path.join(base_dir, Settings().RESULTS_DIR),
        os.path.join(base_dir, Settings().RESULTS_DIR, Settings().FRAME_EXTRACTION.FRAMES_DIR)
    ]
    
    for directory in dirs:
        os.makedirs(directory, exist_ok=True)
        print(f"Created directory: {directory}")

# Create directories on import
create_directories()

settings = Settings() 