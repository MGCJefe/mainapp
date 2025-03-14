"""
Metadata module for frame extraction service.
Handles storing and retrieving frame metadata.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Union, Any
from datetime import datetime

from app.core.config import settings
from app.services.frame_extraction.utils import get_frame_output_dir

logger = logging.getLogger(__name__)

def save_frame_metadata(video_id: str, frames_data: List[Dict]) -> bool:
    """
    Save frame metadata to a JSON file.
    
    Args:
        video_id: ID of the video
        frames_data: List of frame data dictionaries
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get output directory
        output_dir = get_frame_output_dir(video_id)
        os.makedirs(output_dir, exist_ok=True)
        
        # Create metadata file path
        metadata_file = output_dir / "metadata.json"
        
        # Convert datetime objects to ISO format strings for JSON serialization
        serializable_data = []
        for frame in frames_data:
            frame_copy = frame.copy()
            if isinstance(frame_copy.get('created_at'), datetime):
                frame_copy['created_at'] = frame_copy['created_at'].isoformat()
            serializable_data.append(frame_copy)
        
        # Write metadata to file
        with open(metadata_file, 'w') as f:
            json.dump(serializable_data, f, indent=2)
        
        logger.info(f"Saved metadata for {len(frames_data)} frames to {metadata_file}")
        return True
    
    except Exception as e:
        logger.error(f"Error saving frame metadata: {e}")
        return False

def load_frame_metadata(video_id: str) -> List[Dict]:
    """
    Load frame metadata from a JSON file.
    
    Args:
        video_id: ID of the video
        
    Returns:
        List of frame data dictionaries
    """
    try:
        # Get output directory
        output_dir = get_frame_output_dir(video_id)
        
        # Create metadata file path
        metadata_file = output_dir / "metadata.json"
        
        # Check if metadata file exists
        if not metadata_file.exists():
            logger.warning(f"Metadata file not found for video {video_id}")
            return []
        
        # Read metadata from file
        with open(metadata_file, 'r') as f:
            data = json.load(f)
        
        logger.info(f"Loaded metadata for {len(data)} frames from {metadata_file}")
        return data
    
    except Exception as e:
        logger.error(f"Error loading frame metadata: {e}")
        return []

def update_frame_selection(video_id: str, frame_ids: List[str], selected: bool = True) -> bool:
    """
    Update frame selection status in metadata.
    
    Args:
        video_id: ID of the video
        frame_ids: List of frame IDs to update
        selected: Whether to mark as selected (True) or unselected (False)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Load existing metadata
        frames_data = load_frame_metadata(video_id)
        if not frames_data:
            return False
        
        # Update selection status
        updated = False
        for frame in frames_data:
            if frame.get('frame_id') in frame_ids:
                frame['selected'] = selected
                updated = True
        
        # If nothing was updated, return False
        if not updated:
            return False
        
        # Save updated metadata
        return save_frame_metadata(video_id, frames_data)
    
    except Exception as e:
        logger.error(f"Error updating frame selection: {e}")
        return False

def get_selected_frames(video_id: str) -> List[Dict]:
    """
    Get only selected frames from metadata.
    
    Args:
        video_id: ID of the video
        
    Returns:
        List of selected frame data dictionaries
    """
    try:
        # Load existing metadata
        frames_data = load_frame_metadata(video_id)
        
        # Filter selected frames
        selected_frames = [frame for frame in frames_data if frame.get('selected', False)]
        
        return selected_frames
    
    except Exception as e:
        logger.error(f"Error getting selected frames: {e}")
        return []

def delete_frame_metadata(video_id: str, frame_ids: Optional[List[str]] = None) -> bool:
    """
    Delete frame metadata.
    
    Args:
        video_id: ID of the video
        frame_ids: Optional list of frame IDs to delete. If None, all metadata is deleted.
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get metadata file path
        output_dir = get_frame_output_dir(video_id)
        metadata_file = output_dir / "metadata.json"
        
        # If no specific frame IDs, delete the entire metadata file
        if not frame_ids:
            if metadata_file.exists():
                os.remove(metadata_file)
                logger.info(f"Deleted metadata file for video {video_id}")
            return True
        
        # Load existing metadata
        frames_data = load_frame_metadata(video_id)
        if not frames_data:
            return True  # No metadata to delete
        
        # Filter out frames to delete
        updated_frames = [frame for frame in frames_data if frame.get('frame_id') not in frame_ids]
        
        # Save updated metadata
        return save_frame_metadata(video_id, updated_frames)
    
    except Exception as e:
        logger.error(f"Error deleting frame metadata: {e}")
        return False 