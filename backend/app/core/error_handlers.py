"""
Custom error handlers for the application.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
from typing import Dict, Any, Optional, List, Type
from pydantic import ValidationError

logger = logging.getLogger(__name__)

class FrameExtractionError(Exception):
    """Base exception for frame extraction errors."""
    def __init__(
        self, 
        message: str, 
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

class VideoNotFoundError(FrameExtractionError):
    """Exception raised when a video is not found."""
    def __init__(self, video_id: str, message: Optional[str] = None):
        self.video_id = video_id
        super().__init__(
            message or f"Video with ID {video_id} not found",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"video_id": video_id}
        )

class FrameNotFoundError(FrameExtractionError):
    """Exception raised when frames are not found."""
    def __init__(self, video_id: str, frame_ids: Optional[List[str]] = None, message: Optional[str] = None):
        self.video_id = video_id
        self.frame_ids = frame_ids
        details = {"video_id": video_id}
        if frame_ids:
            details["frame_ids"] = frame_ids
        super().__init__(
            message or f"Frames not found for video {video_id}",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details
        )

class ProcessingError(FrameExtractionError):
    """Exception raised when there's an error processing video or frames."""
    def __init__(self, message: str, error_type: str, details: Optional[Dict[str, Any]] = None):
        self.error_type = error_type
        error_details = details or {}
        error_details["error_type"] = error_type
        super().__init__(
            message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=error_details
        )

def register_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers for the application."""
    
    @app.exception_handler(FrameExtractionError)
    async def frame_extraction_exception_handler(
        request: Request, exc: FrameExtractionError
    ) -> JSONResponse:
        """Handle FrameExtractionError exceptions."""
        logger.error(f"FrameExtractionError: {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": True,
                "message": exc.message,
                "details": exc.details,
                "status_code": exc.status_code
            }
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle validation errors."""
        error_details = []
        for error in exc.errors():
            loc = " -> ".join([str(l) for l in error.get("loc", [])])
            error_details.append({
                "location": loc,
                "message": error.get("msg", "Validation error"),
                "type": error.get("type", "")
            })
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": True,
                "message": "Request validation error",
                "details": error_details,
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY
            }
        )
    
    @app.exception_handler(ValidationError)
    async def pydantic_validation_exception_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": True,
                "message": "Data validation error",
                "details": exc.errors(),
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY
            }
        )
    
    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle any unhandled exceptions."""
        logger.exception(f"Unhandled exception: {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": True,
                "message": "An unexpected error occurred",
                "details": {"error": str(exc)},
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
            }
        ) 