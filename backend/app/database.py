from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings


class Base(DeclarativeBase):
    pass


def get_engine():
    settings = get_settings()
    return create_async_engine(settings.database_url, echo=False)


engine = None
async_session_factory = None


def init_engine():
    global engine, async_session_factory
    engine = get_engine()
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    global async_session_factory
    if async_session_factory is None:
        init_engine()
    async with async_session_factory() as session:
        yield session


async def create_tables():
    global engine
    if engine is None:
        init_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
