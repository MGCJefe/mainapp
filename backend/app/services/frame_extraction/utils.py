"""
Utility functions for frame extraction.
"""

import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Union
import cv2
import numpy as np
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)

def get_video_info(video_path: Union[str, Path]) -> Dict:
    """
    Get basic information about a video file.
    
    Args:
        video_path: Path to the video file
        
    Returns:
        Dictionary containing video information
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0
    
    # Release the video capture
    cap.release()
    
    return {
        "width": width,
        "height": height,
        "fps": fps,
        "frame_count": frame_count,
        "duration": duration,
        "duration_formatted": format_duration(duration)
    }

def format_duration(seconds: float) -> str:
    """
    Format duration in seconds to a human-readable string.
    
    Args:
        seconds: Duration in seconds
        
    Returns:
        Formatted duration string (HH:MM:SS)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"

def get_frame_output_dir(video_id: str) -> Path:
    """
    Get the output directory for frames extracted from a video.
    
    Args:
        video_id: Unique identifier for the video
        
    Returns:
        Path to the output directory
    """
    base_dir = Path(settings.RESULTS_DIR) / settings.FRAME_EXTRACTION.FRAMES_DIR / video_id
    
    # Create directory if it doesn't exist
    os.makedirs(base_dir, exist_ok=True)
    
    return base_dir

def timestamp_to_filename(timestamp: float) -> str:
    """
    Convert a timestamp to a filename-friendly string.
    
    Args:
        timestamp: Timestamp in seconds
        
    Returns:
        Formatted timestamp string for filename
    """
    hours = int(timestamp // 3600)
    minutes = int((timestamp % 3600) // 60)
    seconds = int(timestamp % 60)
    
    return f"{hours:02d}-{minutes:02d}-{seconds:02d}" 