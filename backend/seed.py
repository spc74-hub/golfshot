"""
Seed script to create initial owner user and migrate courses.
Run with: python -m seed
"""
import asyncio
import sys
from app.database import init_engine, create_tables, get_engine
from app.models.db_models import Profile, Course
from app.auth import get_password_hash
from app.routers.courses import INITIAL_COURSES
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy import select


async def seed():
    init_engine()
    await create_tables()

    engine = get_engine()
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Create owner user
        result = await db.execute(select(Profile).where(Profile.email == "sergio.porcar@gmail.com"))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Owner user already exists: {existing.id}")
        else:
            owner = Profile(
                email="sergio.porcar@gmail.com",
                hashed_password=get_password_hash("changeme"),
                display_name="Sergio Porcar",
                role="owner",
                status="active",
                permissions=[],
            )
            db.add(owner)
            await db.commit()
            await db.refresh(owner)
            print(f"Created owner user: {owner.id} ({owner.email})")

        # Migrate initial courses
        result = await db.execute(select(Course.name))
        existing_names = {row[0] for row in result.all()}

        migrated = []
        for course_data in INITIAL_COURSES:
            if course_data["name"] in existing_names:
                print(f"  Skipping course: {course_data['name']} (already exists)")
                continue

            course = Course(**course_data)
            db.add(course)
            migrated.append(course_data["name"])

        if migrated:
            await db.commit()
            for name in migrated:
                print(f"  Migrated course: {name}")
        else:
            print("  No new courses to migrate")

    print("\nSeed completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
