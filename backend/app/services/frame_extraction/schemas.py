"""
Schemas for frame extraction API.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Union
from datetime import datetime

class FrameExtractionConfig(BaseModel):
    """Configuration for frame extraction."""
    sample_rate: Optional[int] = Field(
        None, 
        description="Sample rate (analyze every Nth frame)"
    )
    max_frames: Optional[int] = Field(
        None, 
        description="Maximum number of frames to extract"
    )
    min_quality_score: Optional[float] = Field(
        None, 
        description="Minimum quality score for a frame to be considered"
    )
    use_parallel: Optional[bool] = Field(
        None, 
        description="Whether to use parallel processing"
    )

class FrameExtractionRequest(BaseModel):
    """Request to extract frames from a video."""
    video_id: str = Field(..., description="ID of the uploaded video")
    config: Optional[FrameExtractionConfig] = Field(
        None, 
        description="Configuration overrides"
    )

class FrameMetrics(BaseModel):
    """Quality metrics for a frame."""
    sharpness: float = Field(..., description="Sharpness score (higher is better)")
    brightness: float = Field(..., description="Brightness value (0-255)")
    contrast: float = Field(..., description="Contrast score")
    quality_score: float = Field(..., description="Overall quality score")

class FrameData(BaseModel):
    """Data for an extracted frame."""
    frame_id: str = Field(..., description="Unique ID for the frame")
    video_id: str = Field(..., description="ID of the source video")
    frame_number: int = Field(..., description="Frame number in the video")
    timestamp: float = Field(..., description="Timestamp in seconds")
    timestamp_formatted: str = Field(..., description="Formatted timestamp (HH:MM:SS)")
    file_path: str = Field(..., description="Path to the frame file")
    thumbnail_path: Optional[str] = Field(None, description="Path to the thumbnail file")
    file_url: Optional[str] = Field(None, description="URL to access the frame file")
    thumbnail_url: Optional[str] = Field(None, description="URL to access the thumbnail file")
    metrics: FrameMetrics = Field(..., description="Quality metrics")
    width: int = Field(..., description="Frame width")
    height: int = Field(..., description="Frame height")
    created_at: datetime = Field(..., description="When the frame was extracted")

class FrameExtractionResponse(BaseModel):
    """Response for frame extraction request."""
    task_id: str = Field(..., description="ID of the extraction task")
    video_id: str = Field(..., description="ID of the source video")
    status: str = Field(..., description="Status of the extraction task")
    total_frames: int = Field(..., description="Total number of frames to be processed")
    frames_processed: int = Field(..., description="Number of frames processed so far")
    frames_extracted: int = Field(..., description="Number of frames that met quality criteria")
    config: FrameExtractionConfig = Field(..., description="Configuration used")
    created_at: datetime = Field(..., description="When the task was created")
    updated_at: datetime = Field(..., description="When the task was last updated")

class FramesListResponse(BaseModel):
    """Response containing a list of extracted frames."""
    video_id: str = Field(..., description="ID of the source video")
    frames_count: int = Field(..., description="Number of frames in the list")
    frames: List[FrameData] = Field(..., description="List of frames")

class FrameSelectionRequest(BaseModel):
    """Request to select specific frames."""
    video_id: str = Field(..., description="ID of the source video")
    frame_ids: List[str] = Field(..., description="IDs of the frames to select")

class FrameSelectionResponse(BaseModel):
    """Response for frame selection."""
    video_id: str = Field(..., description="ID of the source video")
    selected_frames: int = Field(..., description="Number of frames selected")
    frame_ids: List[str] = Field(..., description="IDs of the selected frames") 