"""CoursePlanner Backend - FastAPI Application."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import courses, schedule, constraints, progress, ratings
from app.core.data_loader import load_courses, load_ratings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data on startup."""
    print("[CoursePlanner] Loading course data...")
    loaded = load_courses()
    # Inject into the courses module's store
    courses._COURSES.update(loaded)
    print(f"[CoursePlanner] {len(loaded)} courses ready.")

    print("[CoursePlanner] Loading professor ratings...")
    loaded_ratings = load_ratings()
    # Inject into the ratings module's store
    ratings._RATINGS.update(loaded_ratings)
    print(f"[CoursePlanner] {len(loaded_ratings)} professor ratings ready.")
    yield


app = FastAPI(
    title="CoursePlanner API",
    description="HKUST Personalized Course Planner - Backend API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS - allow frontend dev server and production.
# Production origins can be added via the ALLOWED_ORIGINS env var
# (comma-separated, e.g. "https://courseplanner.vercel.app").
_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",
    "http://localhost:4173",  # Vite preview
] + [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(schedule.router, prefix="/api/schedule", tags=["schedule"])
app.include_router(constraints.router, prefix="/api/constraints", tags=["constraints"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(ratings.router, prefix="/api/ratings", tags=["ratings"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "name": "CoursePlanner API"}
