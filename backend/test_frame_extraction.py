#!/usr/bin/env python
"""
Test script for frame extraction functionality.
"""

import os
import sys
import logging
import argparse
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Make sure the app modules are in the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.frame_extraction.analyzer import FrameAnalyzer
from app.services.frame_extraction.utils import get_video_info

def test_frame_extraction(video_path, sample_rate=None, max_frames=None, min_quality=None, use_parallel=True):
    """
    Test frame extraction functionality.
    
    Args:
        video_path: Path to the video file
        sample_rate: Sample rate for frame extraction
        max_frames: Maximum number of frames to extract
        min_quality: Minimum quality score for frames
        use_parallel: Whether to use parallel processing
    """
    logger.info(f"Testing frame extraction on: {video_path}")
    
    # Validate video path
    if not os.path.exists(video_path):
        logger.error(f"Video file not found: {video_path}")
        return
    
    # Get video info
    try:
        video_info = get_video_info(video_path)
        logger.info(f"Video info: {video_info}")
    except Exception as e:
        logger.error(f"Error getting video info: {e}")
        return
    
    # Configure the analyzer
    config = {
        'use_parallel': use_parallel
    }
    if sample_rate is not None:
        config['sample_rate'] = sample_rate
    if max_frames is not None:
        config['max_frames'] = max_frames
    if min_quality is not None:
        config['min_quality_score'] = min_quality
    
    # Create the analyzer
    try:
        analyzer = FrameAnalyzer(video_path, config)
        logger.info(f"Created analyzer with config: {config}")
    except Exception as e:
        logger.error(f"Error creating analyzer: {e}")
        return
    
    # Analyze the video
    try:
        frames = analyzer.analyze_video()
        logger.info(f"Analyzed video and found {len(frames)} frames")
        
        if frames:
            # Print the top 5 frames with their metrics
            logger.info("Top 5 frames by quality score:")
            for i, frame in enumerate(frames[:5]):
                logger.info(f"Frame {i+1}: quality={frame['metrics']['quality_score']:.2f}, "
                          f"sharpness={frame['metrics']['sharpness']:.2f}, "
                          f"brightness={frame['metrics']['brightness']:.2f}, "
                          f"contrast={frame['metrics']['contrast']:.2f}, "
                          f"timestamp={frame['timestamp_formatted']}")
        else:
            logger.warning("No frames extracted!")
            return
    except Exception as e:
        logger.error(f"Error analyzing video: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return
    
    # Save the frames
    try:
        output_dir = Path("test_frames") / Path(video_path).stem
        saved_frames = analyzer.save_frames(frames, output_dir=output_dir)
        logger.info(f"Saved {len(saved_frames)} frames to {output_dir}")
        
        # Print paths to the first few saved frames
        if saved_frames:
            logger.info("Saved frame paths:")
            for i, frame in enumerate(saved_frames[:3]):
                logger.info(f"Frame {i+1}: {frame['file_path']}")
                logger.info(f"Thumbnail: {frame['thumbnail_path']}")
    except Exception as e:
        logger.error(f"Error saving frames: {e}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test frame extraction")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sample-rate", type=int, help="Sample rate for frame extraction")
    parser.add_argument("--max-frames", type=int, help="Maximum number of frames to extract")
    parser.add_argument("--min-quality", type=float, help="Minimum quality score for frames")
    parser.add_argument("--no-parallel", action="store_true", help="Disable parallel processing")
    
    args = parser.parse_args()
    
    test_frame_extraction(
        args.video_path,
        sample_rate=args.sample_rate,
        max_frames=args.max_frames,
        min_quality=args.min_quality,
        use_parallel=not args.no_parallel
    ) 