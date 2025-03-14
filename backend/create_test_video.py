#!/usr/bin/env python
"""
Create a test video for frame extraction testing.
"""

import cv2
import numpy as np
import os
from pathlib import Path
import argparse

def create_test_video(
    output_path: str, 
    duration_seconds: int = 10, 
    fps: int = 30,
    width: int = 1280,
    height: int = 720
):
    """
    Create a test video with changing content for frame extraction testing.
    
    Args:
        output_path: Path to save the video
        duration_seconds: Duration of the video in seconds
        fps: Frames per second
        width: Video width
        height: Video height
    """
    # Create output directory if needed
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    # Video settings
    total_frames = duration_seconds * fps
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # or 'XVID'
    
    # Create video writer
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    # Create frames with changing content
    for i in range(total_frames):
        # Time in seconds
        t = i / fps
        
        # Create a blank frame
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Add a moving gradient background (changes over time)
        for y in range(height):
            for x in range(width):
                r = int(128 + 127 * np.sin(x * 0.01 + t))
                g = int(128 + 127 * np.sin(y * 0.01 + t * 0.7))
                b = int(128 + 127 * np.sin((x+y) * 0.01 + t * 1.3))
                frame[y, x] = [b, g, r]
        
        # Add a clock/timestamp
        time_str = f"{int(t // 60):02d}:{int(t % 60):02d}:{int((t % 1) * 100):02d}"
        cv2.putText(
            frame, time_str, (width // 2 - 100, height // 2), 
            cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 0), 3
        )
        cv2.putText(
            frame, time_str, (width // 2 - 100, height // 2), 
            cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 2
        )
        
        # Add frame counter
        frame_text = f"Frame: {i}/{total_frames}"
        cv2.putText(
            frame, frame_text, (50, 50), 
            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 3
        )
        cv2.putText(
            frame, frame_text, (50, 50), 
            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2
        )
        
        # Every 30 frames (1 second), add a different pattern
        if i % 30 == 0:
            # Add a circle
            radius = min(width, height) // 4
            cv2.circle(
                frame, 
                (width // 2, height // 2), 
                radius, 
                (0, 0, 255), 
                5
            )
        
        # Every 60 frames (2 seconds), add another pattern
        if i % 60 == 0:
            # Add a rectangle
            cv2.rectangle(
                frame, 
                (width // 4, height // 4), 
                (width * 3 // 4, height * 3 // 4), 
                (0, 255, 0), 
                5
            )
        
        # Every 90 frames (3 seconds), add another pattern
        if i % 90 == 0:
            # Add crossed lines
            cv2.line(frame, (0, 0), (width, height), (255, 0, 0), 5)
            cv2.line(frame, (width, 0), (0, height), (255, 0, 0), 5)
        
        # Add dynamic blur to some frames to test sharpness detection
        if 120 <= i < 150:  # Between 4 and 5 seconds
            kernel_size = 10
            frame = cv2.GaussianBlur(frame, (kernel_size, kernel_size), 0)
        
        # Add darkness to some frames to test brightness detection
        if 180 <= i < 210:  # Between 6 and 7 seconds
            frame = cv2.convertScaleAbs(frame, alpha=0.3, beta=0)
        
        # Add low contrast to some frames
        if 240 <= i < 270:  # Between 8 and 9 seconds
            frame = cv2.convertScaleAbs(frame, alpha=0.5, beta=127)
        
        # Write the frame
        out.write(frame)
        
        # Print progress
        if i % fps == 0:
            print(f"Created {i}/{total_frames} frames ({i/total_frames*100:.1f}%)")
    
    # Release resources
    out.release()
    print(f"Created test video at {output_path}")
    print(f"Duration: {duration_seconds} seconds, FPS: {fps}, Resolution: {width}x{height}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a test video")
    parser.add_argument(
        "--output", 
        default="backend/uploads/videos/test_video.mp4",
        help="Output path for the video"
    )
    parser.add_argument(
        "--duration", 
        type=int, 
        default=10,
        help="Duration in seconds"
    )
    parser.add_argument(
        "--fps", 
        type=int, 
        default=30,
        help="Frames per second"
    )
    parser.add_argument(
        "--width", 
        type=int, 
        default=1280,
        help="Video width"
    )
    parser.add_argument(
        "--height", 
        type=int, 
        default=720,
        help="Video height"
    )
    
    args = parser.parse_args()
    
    create_test_video(
        args.output,
        args.duration,
        args.fps,
        args.width,
        args.height
    ) 