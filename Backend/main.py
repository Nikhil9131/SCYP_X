"""
Root entry point for Backend uvicorn server.
Imports and exposes the FastAPI app from Backend.app.main
to support both `py -m uvicorn Backend.main:app` and `start_all.bat`.
"""

from Backend.app.main import app

__all__ = ["app"]
