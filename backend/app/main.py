import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, users, courses, rounds, admin, players, templates

settings = get_settings()

# Log CORS configuration at startup (flush immediately)
cors_origins = settings.get_cors_origins()
print(f"[CORS] Configured origins: {cors_origins}", flush=True)
print(f"[CORS] Frontend URL from env: '{settings.frontend_url}'", flush=True)

app = FastAPI(
    title="Golf Shot API",
    description="API for Golf Shot - Golf round tracking application",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(rounds.router)
app.include_router(players.router)
app.include_router(templates.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {
        "message": "Golf Shot API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
