"""CoursePlanner - HKUST Personalized Course Planner

Entry point for running the full application.

Usage:
    # Start the backend API server
    python main.py

    # Or with uvicorn directly:
    uvicorn backend.app.main:app --reload --port 8000
"""

import sys
from pathlib import Path

# Add backend to path so we can import from 'app'
sys.path.insert(0, str(Path(__file__).parent / "backend"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(Path(__file__).parent / "backend")],
    )
