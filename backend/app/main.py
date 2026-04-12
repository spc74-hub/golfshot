from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import create_tables, init_engine
from app.routers import auth, users, courses, rounds, admin, players, templates, handicap_history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_engine()
    await create_tables()
    yield
    # Shutdown


settings = get_settings()

cors_origins = settings.get_cors_origins()
print(f"[CORS] Configured origins: {cors_origins}", flush=True)

app = FastAPI(
    title="Golf Shot API",
    description="API for Golf Shot - Golf round tracking application",
    version="1.0.0",
    lifespan=lifespan,
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
app.include_router(handicap_history.router)
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
