"""
Router for frame extraction endpoints.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from typing import Dict, List, Optional
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path as PathLib
import json

from app.core.config import settings
from app.core.error_handlers import VideoNotFoundError, FrameNotFoundError, ProcessingError
from app.services.frame_extraction.analyzer import FrameAnalyzer
from app.services.frame_extraction.utils import get_video_info, get_frame_output_dir
from app.services.frame_extraction.metadata import (
    save_frame_metadata,
    load_frame_metadata,
    update_frame_selection,
    get_selected_frames,
    delete_frame_metadata
)
from app.services.frame_extraction.schemas import (
    FrameExtractionRequest,
    FrameExtractionResponse,
    FramesListResponse,
    FrameSelectionRequest,
    FrameSelectionResponse,
    FrameData,
    FrameMetrics,
    FrameExtractionConfig
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Map of task_ids to task information
active_tasks = {}

# Debug endpoint to check metadata files
@router.get("/debug/{video_id}", response_model=Dict)
async def debug_metadata(video_id: str):
    """
    Debug endpoint to check if metadata files exist for a given video_id.
    
    Args:
        video_id: ID of the video to check
        
    Returns:
        Debug information about the metadata files
    """
    try:
        # Get the frame output directory
        output_dir = get_frame_output_dir(video_id)
        metadata_path = output_dir / "metadata.json"
        
        # Check if the directory exists
        dir_exists = os.path.isdir(output_dir)
        
        # Check if the metadata file exists
        metadata_exists = os.path.isfile(metadata_path)
        
        # Try to load the metadata if it exists
        metadata_content = None
        if metadata_exists:
            try:
                with open(metadata_path, 'r') as f:
                    metadata_content = json.load(f)
            except Exception as e:
                metadata_content = f"Error reading metadata: {str(e)}"
        
        # List all files in the directory
        files_in_dir = []
        if dir_exists:
            files_in_dir = os.listdir(output_dir)
        
        # Get the base frames directory
        base_frames_dir = PathLib(settings.RESULTS_DIR) / settings.FRAME_EXTRACTION.FRAMES_DIR
        
        # List all video directories
        all_video_dirs = []
        if os.path.isdir(base_frames_dir):
            all_video_dirs = os.listdir(base_frames_dir)
        
        return {
            "video_id": video_id,
            "directory_path": str(output_dir),
            "directory_exists": dir_exists,
            "metadata_path": str(metadata_path),
            "metadata_exists": metadata_exists,
            "files_in_directory": files_in_dir,
            "frames_base_dir": str(base_frames_dir),
            "all_video_dirs": all_video_dirs,
            "metadata_content": metadata_content
        }
    except Exception as e:
        logger.error(f"Error in debug endpoint: {e}")
        return {
            "error": str(e),
            "video_id": video_id
        }

def convert_path_to_url(request: Request, file_path: str) -> str:
    """
    Convert a file path to a URL that can be accessed by the frontend.
    
    Args:
        request: The FastAPI request object
        file_path: The file path to convert
        
    Returns:
        URL that can be accessed by the frontend
    """
    if not file_path:
        return None
        
    # Get the base URL from the request
    base_url = str(request.base_url).rstrip('/')
    
    # Handle relative paths that start with "results/" or "uploads/"
    if file_path.startswith("results/"):
        return f"{base_url}/{file_path}"
    
    if file_path.startswith("uploads/"):
        return f"{base_url}/{file_path}"
    
    # Convert the file path to a URL for absolute paths
    path = PathLib(file_path)
    
    # Check if the path is in the results directory
    results_dir = PathLib(os.path.abspath(settings.RESULTS_DIR))
    if str(results_dir) in str(path) or settings.RESULTS_DIR in str(path):
        # Extract the part of the path after "results"
        if settings.RESULTS_DIR in str(path):
            parts = str(path).split(settings.RESULTS_DIR)
            if len(parts) > 1:
                return f"{base_url}/results{parts[1].replace(os.sep, '/')}"
        else:
            parts = str(path).split(results_dir.name)
            if len(parts) > 1:
                return f"{base_url}/results{parts[1].replace(os.sep, '/')}"
    
    # Check if the path is in the uploads directory
    uploads_dir = PathLib(os.path.abspath(settings.UPLOAD_DIR))
    if str(uploads_dir) in str(path) or settings.UPLOAD_DIR in str(path):
        # Extract the part of the path after "uploads"
        if settings.UPLOAD_DIR in str(path):
            parts = str(path).split(settings.UPLOAD_DIR)
            if len(parts) > 1:
                return f"{base_url}/uploads{parts[1].replace(os.sep, '/')}"
        else:
            parts = str(path).split(uploads_dir.name)
            if len(parts) > 1:
                return f"{base_url}/uploads{parts[1].replace(os.sep, '/')}"
    
    # If we can't determine the URL, log a warning and return a fallback URL
    logger.warning(f"Could not convert path to URL: {file_path}")
    
    # Try to extract the filename and create a URL based on the video_id if available
    filename = os.path.basename(file_path)
    if "thumbnails" in file_path:
        # This is likely a thumbnail
        video_id = file_path.split(os.sep)[-3] if os.sep in file_path else None
        if video_id and len(video_id) > 30:  # Likely a UUID
            return f"{base_url}/results/frames/{video_id}/thumbnails/{filename}"
    else:
        # This is likely a full frame
        video_id = file_path.split(os.sep)[-2] if os.sep in file_path else None
        if video_id and len(video_id) > 30:  # Likely a UUID
            return f"{base_url}/results/frames/{video_id}/{filename}"
    
    # Last resort: return the original path
    return file_path

@router.post("/extract", response_model=FrameExtractionResponse)
async def extract_frames(request: FrameExtractionRequest, background_tasks: BackgroundTasks):
    """
    Extract frames from a video.
    
    This endpoint starts a background task to extract frames from a video.
    The task will run asynchronously and update the task status.
    """
    video_id = request.video_id
    logger.info(f"Received frame extraction request for video ID: {video_id}")
    
    # Construct video path from the ID
    video_dir = PathLib(settings.UPLOAD_DIR) / "videos"
    logger.info(f"Looking for video in directory: {video_dir}")
    
    # First try exact match with the ID
    video_files = list(video_dir.glob(f"{video_id}.*"))
    logger.info(f"Found {len(video_files)} files with exact match pattern '{video_id}.*'")
    
    # If no exact match, try to find a file that contains the ID
    if not video_files:
        logger.warning(f"No exact match for video ID: {video_id}, trying partial match")
        all_files = list(video_dir.glob("*.*"))
        logger.info(f"Total files in directory: {len(all_files)}")
        logger.info(f"Files in directory: {[f.name for f in all_files]}")
        video_files = [f for f in all_files if video_id in f.name]
        logger.info(f"Found {len(video_files)} files with partial match")
    
    # If still no match, try the test video as a fallback
    if not video_files and os.path.exists(str(video_dir / "test_video.mp4")):
        logger.warning(f"Using test_video.mp4 as fallback for video ID: {video_id}")
        video_files = [video_dir / "test_video.mp4"]
    
    if not video_files:
        logger.error(f"Video not found for ID: {video_id}")
        raise VideoNotFoundError(video_id)
    
    video_path = str(video_files[0])
    logger.info(f"Found video file: {video_path}")
    
    # Create configuration for the analyzer
    config_dict = {}
    if request.config:
        config_dict = request.config.dict(exclude_none=True)
    
    # Get video info
    try:
        video_info = get_video_info(video_path)
        logger.info(f"Video info: {video_info}")
    except Exception as e:
        logger.error(f"Error getting video info: {e}")
        raise ProcessingError(
            message=f"Error getting video info: {str(e)}",
            error_type="video_info_error",
            details={"video_id": video_id}
        )
    
    # Create task ID and setup initial task status
    task_id = str(uuid.uuid4())
    now = datetime.now()
    
    task_info = {
        "task_id": task_id,
        "video_id": video_id,
        "status": "pending",
        "total_frames": video_info["frame_count"],
        "frames_processed": 0,
        "frames_extracted": 0,
        "config": FrameExtractionConfig(**config_dict),
        "created_at": now,
        "updated_at": now
    }
    
    active_tasks[task_id] = task_info
    logger.info(f"Created task {task_id} for video {video_id}")
    
    # Add task to background tasks
    background_tasks.add_task(
        process_video_frames,
        task_id=task_id,
        video_path=video_path,
        config=config_dict
    )
    
    # Return initial task status
    return FrameExtractionResponse(**task_info)

@router.get("/task/{task_id}", response_model=FrameExtractionResponse)
async def get_task_status(task_id: str):
    """
    Get the status of a frame extraction task.
    """
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return FrameExtractionResponse(**active_tasks[task_id])

@router.get("/{video_id}", response_model=FramesListResponse)
async def list_frames(video_id: str, selected_only: bool = False, request: Request = None):
    """
    List extracted frames for a video.
    
    Args:
        video_id: ID of the video
        selected_only: If True, only return frames that have been marked as selected
        request: The FastAPI request object
    """
    # Get the output directory for this video
    frames_dir = get_frame_output_dir(video_id)
    
    if not frames_dir.exists():
        return FramesListResponse(
            video_id=video_id,
            frames_count=0,
            frames=[]
        )
    
    # Load metadata
    frames_metadata = load_frame_metadata(video_id)
    
    # Filter selected frames if requested
    if selected_only:
        frames_metadata = [frame for frame in frames_metadata if frame.get('selected', False)]
    
    # If no metadata found, return empty response
    if not frames_metadata:
        # Fallback to scanning directory if metadata doesn't exist
        frame_files = list(frames_dir.glob("*.jpg"))
        if not frame_files:
            return FramesListResponse(
                video_id=video_id,
                frames_count=0,
                frames=[]
            )
        
        # Create basic metadata from files (this is legacy support for frames extracted before metadata)
        frames = []
        for frame_file in frame_files:
            try:
                # Parse frame ID from filename (format: timestamp_uuid.jpg)
                file_parts = frame_file.stem.split('_')
                if len(file_parts) >= 2:
                    frame_id = file_parts[-1]  # The last part should be the UUID
                else:
                    frame_id = str(uuid.uuid4())  # Fallback
                
                # Check for thumbnail
                thumbnail_path = frames_dir / "thumbnails" / frame_file.name
                thumbnail_path_str = str(thumbnail_path) if thumbnail_path.exists() else None
                
                # Convert paths to URLs
                file_url = convert_path_to_url(request, str(frame_file))
                thumbnail_url = convert_path_to_url(request, thumbnail_path_str)
                
                # Get image dimensions if possible
                try:
                    import cv2
                    img = cv2.imread(str(frame_file))
                    height, width = img.shape[:2]
                except:
                    width, height = 1280, 720  # Fallback dimensions
                
                # Create frame data
                frames.append(
                    FrameData(
                        frame_id=frame_id,
                        video_id=video_id,
                        frame_number=0,  # Unknown
                        timestamp=0.0,  # Unknown
                        timestamp_formatted="00:00:00",  # Unknown
                        file_path=str(frame_file),
                        thumbnail_path=thumbnail_path_str,
                        file_url=file_url,  # Add URL
                        thumbnail_url=thumbnail_url,  # Add URL
                        metrics=FrameMetrics(
                            sharpness=0.0,  # Unknown
                            brightness=0.0,  # Unknown
                            contrast=0.0,  # Unknown
                            quality_score=0.0  # Unknown
                        ),
                        width=width,
                        height=height,
                        created_at=datetime.now()
                    )
                )
            except Exception as e:
                logger.error(f"Error processing frame file {frame_file}: {e}")
        
        return FramesListResponse(
            video_id=video_id,
            frames_count=len(frames),
            frames=frames
        )
    
    # Convert metadata to FrameData objects
    frames = []
    for frame_meta in frames_metadata:
        try:
            # Check if thumbnail exists
            thumbnail_path = frame_meta.get('thumbnail_path')
            if thumbnail_path and not os.path.exists(thumbnail_path):
                thumbnail_path = None
            
            # Check if main image exists
            file_path = frame_meta.get('file_path')
            if not file_path or not os.path.exists(file_path):
                continue  # Skip this frame if the file doesn't exist
            
            # Convert paths to URLs
            file_url = convert_path_to_url(request, file_path)
            thumbnail_url = convert_path_to_url(request, thumbnail_path)
            
            # Convert created_at from string to datetime if needed
            created_at = frame_meta.get('created_at')
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except:
                    created_at = datetime.now()
            elif not isinstance(created_at, datetime):
                created_at = datetime.now()
            
            # Create FrameData object
            frames.append(
                FrameData(
                    frame_id=frame_meta.get('frame_id'),
                    video_id=frame_meta.get('video_id', video_id),
                    frame_number=frame_meta.get('frame_number', 0),
                    timestamp=frame_meta.get('timestamp', 0.0),
                    timestamp_formatted=frame_meta.get('timestamp_formatted', "00:00:00"),
                    file_path=file_path,
                    thumbnail_path=thumbnail_path,
                    file_url=file_url,  # Add URL
                    thumbnail_url=thumbnail_url,  # Add URL
                    metrics=FrameMetrics(
                        sharpness=frame_meta.get('metrics', {}).get('sharpness', 0.0),
                        brightness=frame_meta.get('metrics', {}).get('brightness', 0.0),
                        contrast=frame_meta.get('metrics', {}).get('contrast', 0.0),
                        quality_score=frame_meta.get('metrics', {}).get('quality_score', 0.0)
                    ),
                    width=frame_meta.get('width', 1280),
                    height=frame_meta.get('height', 720),
                    created_at=created_at
                )
            )
        except Exception as e:
            logger.error(f"Error converting frame metadata to FrameData: {e}")
    
    return FramesListResponse(
        video_id=video_id,
        frames_count=len(frames),
        frames=frames
    )

@router.post("/select", response_model=FrameSelectionResponse)
async def select_frames(request: FrameSelectionRequest):
    """
    Select specific frames.
    
    This marks the specified frames as selected in the metadata.
    """
    video_id = request.video_id
    frame_ids = request.frame_ids
    
    # Get the output directory for this video
    frames_dir = get_frame_output_dir(video_id)
    
    if not frames_dir.exists():
        raise FrameNotFoundError(video_id=video_id)
    
    # Update frame selection status
    success = update_frame_selection(video_id, frame_ids, selected=True)
    
    if not success:
        raise ProcessingError(
            message=f"Failed to update frame selection for video {video_id}",
            error_type="selection_update_error",
            details={
                "video_id": video_id,
                "frame_ids": frame_ids
            }
        )
    
    return FrameSelectionResponse(
        video_id=video_id,
        selected_frames=len(frame_ids),
        frame_ids=frame_ids
    )

@router.post("/unselect", response_model=FrameSelectionResponse)
async def unselect_frames(request: FrameSelectionRequest):
    """
    Unselect specific frames.
    
    This marks the specified frames as not selected in the metadata.
    """
    video_id = request.video_id
    frame_ids = request.frame_ids
    
    # Get the output directory for this video
    frames_dir = get_frame_output_dir(video_id)
    
    if not frames_dir.exists():
        raise FrameNotFoundError(video_id=video_id)
    
    # Update frame selection status
    success = update_frame_selection(video_id, frame_ids, selected=False)
    
    if not success:
        raise ProcessingError(
            message=f"Failed to update frame selection for video {video_id}",
            error_type="selection_update_error",
            details={
                "video_id": video_id,
                "frame_ids": frame_ids
            }
        )
    
    return FrameSelectionResponse(
        video_id=video_id,
        selected_frames=0,
        frame_ids=frame_ids
    )

@router.get("/{video_id}/selected", response_model=FramesListResponse)
async def get_selected_frames(video_id: str):
    """
    Get only the frames that have been marked as selected.
    
    This is a convenience endpoint that is equivalent to /frames/{video_id}?selected_only=true
    """
    return await list_frames(video_id, selected_only=True)

@router.delete("/{video_id}")
async def delete_frames(video_id: str, frame_ids: Optional[List[str]] = Query(None)):
    """
    Delete frames for a video.
    If frame_ids is provided, only those frames will be deleted.
    Otherwise, all frames for the video will be deleted.
    """
    # Get the output directory for this video
    frames_dir = get_frame_output_dir(video_id)
    
    if not frames_dir.exists():
        raise FrameNotFoundError(video_id=video_id)
    
    if frame_ids:
        # Delete specific frames
        deleted_count = 0
        for frame_id in frame_ids:
            # Find files with this frame ID
            frame_files = list(frames_dir.glob(f"*_{frame_id}.jpg"))
            for frame_file in frame_files:
                # Delete the frame
                try:
                    frame_file.unlink(missing_ok=True)
                except Exception as e:
                    logger.error(f"Error deleting frame file {frame_file}: {e}")
                
                # Delete the thumbnail if it exists
                thumbnail_path = frames_dir / "thumbnails" / frame_file.name
                if thumbnail_path.exists():
                    try:
                        thumbnail_path.unlink()
                    except Exception as e:
                        logger.error(f"Error deleting thumbnail {thumbnail_path}: {e}")
                
                deleted_count += 1
        
        # Update metadata
        delete_frame_metadata(video_id, frame_ids)
        
        return {"message": f"Deleted {deleted_count} frames", "deleted_frames": deleted_count}
    else:
        # Delete all frames
        try:
            import shutil
            shutil.rmtree(frames_dir)
            return {"message": f"Deleted all frames for video {video_id}"}
        except Exception as e:
            logger.error(f"Error deleting frames directory {frames_dir}: {e}")
            raise ProcessingError(
                message=f"Failed to delete frames: {str(e)}",
                error_type="frame_deletion_error",
                details={"video_id": video_id}
            )

@router.get("/debug/{video_id}")
async def debug_video_id(video_id: str):
    """
    Debug endpoint to verify video ID handling.
    """
    # Construct video path from the ID
    video_dir = PathLib(settings.UPLOAD_DIR) / "videos"
    video_files = list(video_dir.glob(f"{video_id}.*"))
    
    # Check if results directory exists
    frames_dir = get_frame_output_dir(video_id)
    
    return {
        "video_id": video_id,
        "video_files_found": [str(f) for f in video_files],
        "video_files_exist": len(video_files) > 0,
        "frames_dir": str(frames_dir),
        "frames_dir_exists": frames_dir.exists(),
        "upload_dir": str(video_dir),
        "upload_dir_exists": video_dir.exists()
    }

# Background task to process video frames
async def process_video_frames(task_id: str, video_path: str, config: dict):
    """
    Background task to process video frames.
    """
    if task_id not in active_tasks:
        logger.error(f"Task {task_id} not found in active tasks")
        return
    
    task_info = active_tasks[task_id]
    video_id = task_info["video_id"]
    logger.info(f"Starting frame extraction for task {task_id}, video {video_id}")
    
    task_info["status"] = "processing"
    task_info["updated_at"] = datetime.now()
    
    try:
        # Ensure results directory exists
        frames_dir = get_frame_output_dir(video_id)
        logger.info(f"Output directory: {frames_dir}")
        
        # Create analyzer
        logger.info(f"Creating analyzer for video: {video_path}")
        analyzer = FrameAnalyzer(video_path, config)
        
        # Extract frames
        logger.info(f"Analyzing video for task {task_id}")
        frames = analyzer.analyze_video()
        
        # Update task info
        task_info["frames_processed"] = task_info["total_frames"]
        task_info["frames_extracted"] = len(frames)
        task_info["updated_at"] = datetime.now()
        
        # Save frames
        if frames:
            logger.info(f"Saving {len(frames)} frames for video {video_id}")
            saved_frames = analyzer.save_frames(frames)
            
            # Save metadata for easy retrieval later
            logger.info(f"Saving metadata for {len(saved_frames)} frames")
            save_frame_metadata(video_id, saved_frames)
            
            logger.info(f"Saved {len(saved_frames)} frames for video {video_id}")
        else:
            logger.warning(f"No frames extracted for video {video_id}")
        
        # Mark task as complete
        task_info["status"] = "completed"
        task_info["updated_at"] = datetime.now()
        logger.info(f"Task {task_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing video frames for task {task_id}: {e}", exc_info=True)
        task_info["status"] = "failed"
        task_info["error"] = str(e)
        task_info["updated_at"] = datetime.now() 