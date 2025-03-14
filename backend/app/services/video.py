import os
import logging
import shutil
import asyncio
from typing import Dict, List, Optional, Tuple, BinaryIO
from uuid import uuid4
from datetime import datetime
from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)

# Constants
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), settings.UPLOAD_DIR)
VIDEOS_DIR = os.path.join(UPLOAD_DIR, "videos")  # Add videos subdirectory
RESULTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), settings.RESULTS_DIR)

# Buffer size for file streaming (8MB chunks)
CHUNK_SIZE = 8 * 1024 * 1024


async def save_uploaded_video(file: UploadFile) -> Dict:
    """
    Save an uploaded video file to the uploads directory.
    Uses streaming to handle large files efficiently.
    Returns metadata about the saved file.
    """
    # Generate a unique ID for this video
    video_id = str(uuid4())
    
    # Extract file extension from the original filename
    file_extension = os.path.splitext(file.filename or "unknown.mp4")[1].lower()
    
    # Create a safe filename with the ID and original extension
    safe_filename = f"{video_id}{file_extension}"
    file_path = os.path.join(VIDEOS_DIR, safe_filename)  # Use VIDEOS_DIR instead of UPLOAD_DIR
    
    # Save the uploaded file using chunked streaming
    try:
        # Ensure directory exists
        os.makedirs(VIDEOS_DIR, exist_ok=True)  # Use VIDEOS_DIR instead of UPLOAD_DIR
        
        # Log start of file save
        logger.info(f"Starting to save file: {file.filename} as {safe_filename}")
        
        # Open file for writing
        with open(file_path, "wb") as buffer:
            # Stream file contents in chunks to handle large files
            bytes_copied = 0
            start_time = datetime.now()
            
            # Read and write in chunks to avoid loading entire file into memory
            while chunk := await file.read(CHUNK_SIZE):
                buffer.write(chunk)
                bytes_copied += len(chunk)
                
                # Periodically log progress for large files
                if bytes_copied % (100 * 1024 * 1024) == 0:  # Log every 100MB
                    elapsed = (datetime.now() - start_time).total_seconds()
                    mb_copied = bytes_copied / (1024 * 1024)
                    speed = mb_copied / elapsed if elapsed > 0 else 0
                    logger.info(f"Upload progress: {mb_copied:.1f}MB at {speed:.1f}MB/s")
                    
            # Log completion
            elapsed = (datetime.now() - start_time).total_seconds()
            mb_copied = bytes_copied / (1024 * 1024)
            speed = mb_copied / elapsed if elapsed > 0 else 0
            logger.info(f"File saved: {safe_filename}, "
                      f"Size: {mb_copied:.1f}MB, "
                      f"Duration: {elapsed:.1f}s, "
                      f"Speed: {speed:.1f}MB/s")
                      
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        # Try to clean up partial file if there was an error
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up partial file after error: {file_path}")
            except:
                pass
        raise
    finally:
        # Close the uploaded file
        await file.close()
    
    # Return metadata about the saved file
    file_size = os.path.getsize(file_path)
    
    return {
        "id": video_id,
        "filename": safe_filename,
        "original_filename": file.filename,
        "path": file_path,
        "upload_time": datetime.now().isoformat(),
        "size": file_size
    }


async def cleanup_original_video(video_id: str) -> bool:
    """
    Delete the original video file after processing is complete.
    Returns True if the file was deleted, False if it wasn't found.
    """
    # Get all files in videos directory with the video_id prefix
    deleted_files = []
    
    for filename in os.listdir(VIDEOS_DIR):
        # Check if the file starts with the video_id
        if filename.startswith(video_id):
            video_path = os.path.join(VIDEOS_DIR, filename)
            
            try:
                if os.path.exists(video_path):
                    file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
                    os.remove(video_path)
                    deleted_files.append(filename)
                    logger.info(f"Deleted original video: {filename} ({file_size_mb:.1f}MB)")
            except Exception as e:
                logger.error(f"Error deleting video file {filename}: {e}")
    
    return len(deleted_files) > 0


async def get_video_metadata(video_id: str) -> Optional[Dict]:
    """
    Get metadata for a video by its ID.
    Returns None if the video doesn't exist.
    """
    # Logic to get video metadata will be implemented in Ticket 2
    # Placeholder for now
    return None 