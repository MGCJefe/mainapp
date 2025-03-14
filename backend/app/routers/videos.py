from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging
import asyncio
import shutil
import tempfile
import os

from app.core.config import settings
from app.services.video import save_uploaded_video, cleanup_original_video

router = APIRouter()
logger = logging.getLogger(__name__)


class VideoResponse(BaseModel):
    id: str
    filename: str
    original_filename: Optional[str]
    upload_time: str
    size: int
    status: str = "uploaded"


@router.post("/upload", response_model=VideoResponse)
async def upload_video(
    request: Request,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
):
    """
    Upload a video file for processing.
    Optimized for handling large files up to 10GB.
    """
    # Check if the file is a video
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # For large files, don't try to load entire file into memory for size check
    # Instead, rely on client-side validation or check during streaming
    
    try:
        # Log the beginning of a large upload
        logger.info(f"Starting upload of video: {file.filename}, content type: {file.content_type}")
        
        # Save the uploaded video
        video_data = await save_uploaded_video(file)
        logger.info(f"Video uploaded successfully: {video_data['id']}, size: {video_data['size'] / (1024 * 1024):.2f} MB")
        
        # Convert to response model
        response = VideoResponse(
            id=video_data["id"],
            filename=video_data["filename"],
            original_filename=video_data["original_filename"],
            upload_time=video_data["upload_time"],
            size=video_data["size"],
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Error during video upload: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.delete("/{video_id}")
async def delete_video(video_id: str):
    """
    Manually delete a video by ID.
    """
    try:
        result = await cleanup_original_video(video_id)
        if result:
            return {"message": f"Video {video_id} deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Video {video_id} not found")
    except Exception as e:
        logger.error(f"Error deleting video {video_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting video: {str(e)}")

# More endpoints will be added in future tickets 