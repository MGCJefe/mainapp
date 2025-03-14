"""
Frame analyzer module for extracting high-quality frames from videos.
"""

import cv2
import numpy as np
import os
import logging
from pathlib import Path
from datetime import datetime
import multiprocessing as mp
from functools import partial
from tqdm import tqdm
from typing import Dict, List, Optional, Tuple, Any, Union
import uuid
from PIL import Image

from app.core.config import settings
from app.services.frame_extraction.utils import get_video_info, get_frame_output_dir, timestamp_to_filename

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FrameAnalyzer:
    """
    Extracts and analyzes frames from videos to identify high-quality keyframes.
    
    This class uses computer vision techniques to evaluate frame quality based on
    sharpness, brightness, contrast, and other factors.
    """
    
    def __init__(self, video_path: Union[str, Path], config: Optional[Dict] = None):
        """
        Initialize the frame analyzer.
        
        Args:
            video_path: Path to the video file
            config: Optional configuration overrides
        """
        self.video_path = str(video_path) if isinstance(video_path, Path) else video_path
        self.config = config or {}
        self.logger = logger
        
        # Configuration with defaults from settings
        self.sample_rate = self.config.get(
            'sample_rate', 
            settings.FRAME_EXTRACTION.DEFAULT_SAMPLE_RATE
        )
        self.max_frames = self.config.get(
            'max_frames', 
            settings.FRAME_EXTRACTION.MAX_FRAMES
        )
        self.use_parallel = self.config.get(
            'use_parallel', 
            settings.FRAME_EXTRACTION.USE_PARALLEL
        )
        self.max_workers = self.config.get(
            'max_workers', 
            settings.FRAME_EXTRACTION.MAX_WORKERS
        )
        self.min_quality_score = self.config.get(
            'min_quality_score', 
            settings.FRAME_EXTRACTION.MIN_QUALITY_SCORE
        )
        self.thumbnail_size = self.config.get(
            'thumbnail_size',
            settings.FRAME_EXTRACTION.THUMBNAIL_SIZE
        )
        self.thumbnail_quality = self.config.get(
            'thumbnail_quality',
            settings.FRAME_EXTRACTION.THUMBNAIL_QUALITY
        )
        
        # Validate video path
        if not os.path.exists(self.video_path):
            raise FileNotFoundError(f"Video file not found: {self.video_path}")
            
        # Get video info
        self.video_info = get_video_info(self.video_path)
        self.logger.info(f"Video info: {self.video_info}")
    
    def analyze_video(self, sample_rate: Optional[int] = None) -> List[Dict]:
        """
        Analyze the video and extract high-quality frames.
        
        Args:
            sample_rate: Override the configured sample rate
            
        Returns:
            List of frame data with quality metrics
        """
        # Use provided sample_rate if given, otherwise use configured value
        effective_sample_rate = sample_rate if sample_rate is not None else self.sample_rate
        
        self.logger.info(f"Analyzing video: {self.video_path} (sample rate: {effective_sample_rate})")
        
        # Open the video
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {self.video_path}")
        
        # Get video properties
        fps = self.video_info['fps']
        frame_count = self.video_info['frame_count']
        
        # Gather frames to analyze based on sample rate
        frames_to_process = []
        frame_number = 0
        
        with tqdm(total=frame_count//effective_sample_rate, desc="Reading frames") as pbar:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                    
                if frame_number % effective_sample_rate == 0:
                    frames_to_process.append((frame, frame_number, fps))
                    pbar.update(1)
                    
                frame_number += 1
                
        cap.release()
        
        frames_to_process_count = len(frames_to_process)
        self.logger.info(f"Processing {frames_to_process_count} frames")
        
        # Process frames based on parallel or sequential mode
        if self.use_parallel and frames_to_process_count > 100:
            frames_data = self._process_frames_parallel(frames_to_process)
        else:
            frames_data = self._process_frames_sequential(frames_to_process)
        
        # Filter frames by quality score if needed
        if self.min_quality_score > 0:
            original_count = len(frames_data)
            frames_data = [f for f in frames_data if f['metrics']['quality_score'] >= self.min_quality_score]
            self.logger.info(f"Filtered {original_count - len(frames_data)} frames below quality threshold")
        
        # Sort frames by quality score in descending order
        frames_data.sort(key=lambda x: x['metrics']['quality_score'], reverse=True)
        
        # Limit the number of frames if needed
        if self.max_frames > 0 and len(frames_data) > self.max_frames:
            frames_data = frames_data[:self.max_frames]
            self.logger.info(f"Limited to {self.max_frames} frames")
        
        self.logger.info(f"Analyzed {frame_count} frames, extracted {len(frames_data)} high-quality frames")
        return frames_data
    
    def _process_frames_sequential(self, frames_to_process: List[Tuple]) -> List[Dict]:
        """Process frames sequentially."""
        frames_data = []
        
        # Set up progress bar
        with tqdm(total=len(frames_to_process), desc="Analyzing frames") as pbar:
            for frame_batch in frames_to_process:
                frame_data = self._process_frame_batch(frame_batch)
                # Only add frames that passed quality checks
                if frame_data['frame'] is not None:
                    frames_data.append(frame_data)
                pbar.update(1)
        
        return frames_data
    
    def _process_frames_parallel(self, frames_to_process: List[Tuple]) -> List[Dict]:
        """Process frames using parallel workers."""
        # Process frames in parallel
        self.logger.info(f"Processing {len(frames_to_process)} frames in parallel with {self.max_workers} workers")
        with mp.Pool(processes=self.max_workers) as pool:
            all_results = list(tqdm(
                pool.imap(self._process_frame_batch, frames_to_process),
                total=len(frames_to_process),
                desc="Processing frames"
            ))
        
        # Filter out rejected frames
        frames_data = [result for result in all_results if result['frame'] is not None]
        
        return frames_data
    
    def _process_frame_batch(self, batch_data: Tuple) -> Dict:
        """Process a single frame batch in parallel worker."""
        frame, frame_number, fps = batch_data
        
        # Step 1: Quick quality check first (80/20 principle)
        laplacian_var, brightness, _ = self._quick_frame_quality(frame)
        
        # If frame fails quick check, return minimal data with None frame to indicate rejection
        if laplacian_var == -1:
            return {
                'frame': None,  # Indicates frame should be rejected
                'frame_id': str(uuid.uuid4()),
                'video_id': os.path.basename(self.video_path).split('.')[0],
                'frame_number': frame_number,
                'timestamp': frame_number / fps,
                'timestamp_formatted': self._format_timestamp(frame_number / fps),
                'metrics': {
                    'sharpness': 0,
                    'brightness': float(brightness),
                    'contrast': 0,
                    'quality_score': 0
                },
                'width': frame.shape[1],
                'height': frame.shape[0],
                'created_at': datetime.now().isoformat()
            }
        
        # Step 2: Detailed analysis only for promising frames
        metrics = self._analyze_detailed_quality(frame, brightness, laplacian_var)
        
        # Create and return frame data
        return self._create_frame_data(frame, frame_number, frame_number / fps, metrics)
    
    def _quick_frame_quality(self, frame: np.ndarray) -> Tuple[float, float, float]:
        """
        Apply 80/20 principle to quickly evaluate frame quality.
        Returns sharpness if frame passes initial checks, -1 otherwise.
        """
        # Downsample frame for faster processing
        small_frame = cv2.resize(frame, (320, 180), interpolation=cv2.INTER_AREA)
        
        # Convert to grayscale
        gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
        
        # Quick brightness check (reject very dark/bright frames)
        brightness = np.mean(gray)
        if brightness < 30 or brightness > 220:
            return -1, brightness, 0
            
        # Quick blur check using Laplacian (most important metric)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F, ksize=1).var()
        
        # Reject obviously blurry frames
        if laplacian_var < 15:  # Threshold may need adjustment based on content
            return -1, brightness, laplacian_var
            
        return laplacian_var, brightness, 0
    
    def _analyze_detailed_quality(self, frame: np.ndarray, brightness: float, laplacian_var: float) -> Dict:
        """
        Analyze frame quality in detail.
        Only called for frames that passed the quick quality check.
        
        Args:
            frame: The frame to analyze
            brightness: Pre-calculated brightness from quick check
            laplacian_var: Pre-calculated Laplacian variance from quick check
            
        Returns:
            Dictionary of quality metrics
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate contrast (standard deviation of pixel values)
        contrast = np.std(gray)
        
        # Normalize contrast to 0-100 range
        normalized_contrast = min(100, contrast * 0.5)
        
        # Normalize sharpness to 0-100 range
        # Using the pre-calculated Laplacian variance
        normalized_sharpness = min(100, laplacian_var)
        
        # Calculate brightness score (optimal around 128)
        brightness_score = 100 - abs(brightness - 128) * 100 / 128
        
        # Calculate overall quality score with weights favoring sharpness
        # Weights: sharpness (70%), brightness (20%), contrast (10%)
        quality_score = (
            0.7 * normalized_sharpness + 
            0.2 * brightness_score + 
            0.1 * normalized_contrast
        )
        
        return {
            "sharpness": float(normalized_sharpness),
            "brightness": float(brightness),
            "contrast": float(normalized_contrast),
            "quality_score": float(quality_score)
        }
    
    def _create_frame_data(self, frame: np.ndarray, frame_number: int, timestamp: float, metrics: Dict) -> Dict:
        """Create frame data dictionary."""
        height, width = frame.shape[:2]
        timestamp_formatted = self._format_timestamp(timestamp)
        
        return {
            "frame_id": str(uuid.uuid4()),
            "video_id": os.path.basename(self.video_path).split('.')[0],
            "frame_number": frame_number,
            "timestamp": timestamp,
            "timestamp_formatted": timestamp_formatted,
            "frame": frame,  # Keep the actual frame data for saving later
            "metrics": metrics,
            "width": width,
            "height": height,
            "created_at": datetime.now().isoformat()
        }
    
    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds to HH:MM:SS."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    
    def save_frames(self, frames_data: List[Dict], output_dir: Optional[Path] = None, create_thumbnails: bool = True) -> List[Dict]:
        """
        Save extracted frames to disk.
        
        Args:
            frames_data: List of frame data
            output_dir: Directory to save frames to
            create_thumbnails: Whether to create thumbnails for UI
            
        Returns:
            List of saved frame paths and thumbnail paths
        """
        # Generate video ID from filename if not present
        video_id = frames_data[0]['video_id'] if frames_data else os.path.basename(self.video_path).split('.')[0]
        
        # Get output directory
        output_dir = output_dir or get_frame_output_dir(video_id)
        os.makedirs(output_dir, exist_ok=True)
        
        # Create thumbnails directory if needed
        thumbnails_dir = output_dir / "thumbnails"
        if create_thumbnails:
            os.makedirs(thumbnails_dir, exist_ok=True)
        
        saved_frames = []
        for frame_data in tqdm(frames_data, desc="Saving frames"):
            frame = frame_data.pop('frame')  # Remove the frame from the data dict
            
            # Create filename
            frame_id = frame_data['frame_id']
            timestamp = frame_data['timestamp']
            filename = f"{timestamp_to_filename(timestamp)}_{frame_id}.jpg"
            
            # Save full-size frame
            frame_path = output_dir / filename
            cv2.imwrite(str(frame_path), frame)
            frame_data['file_path'] = str(frame_path)
            
            # Create and save thumbnail if requested
            if create_thumbnails:
                thumbnail_path = thumbnails_dir / filename
                
                # Resize while maintaining aspect ratio
                h, w = frame.shape[:2]
                new_w = self.thumbnail_size[0]
                new_h = int(h * (new_w / w))
                if new_h > self.thumbnail_size[1]:
                    new_h = self.thumbnail_size[1]
                    new_w = int(w * (new_h / h))
                    
                thumbnail = cv2.resize(frame, (new_w, new_h))
                
                # Save with compression
                encode_params = [cv2.IMWRITE_JPEG_QUALITY, self.thumbnail_quality]
                cv2.imwrite(str(thumbnail_path), thumbnail, encode_params)
                frame_data['thumbnail_path'] = str(thumbnail_path)
            
            saved_frames.append(frame_data)
        
        self.logger.info(f"Saved {len(saved_frames)} frames to {output_dir}")
        return saved_frames 