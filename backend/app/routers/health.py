from fastapi import APIRouter
import platform
import psutil
import time

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Basic health check endpoint to verify the API is operational.
    """
    return {
        "status": "ok",
        "service": "clipcraft-api",
        "timestamp": time.time(),
        "system": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent
        }
    } 