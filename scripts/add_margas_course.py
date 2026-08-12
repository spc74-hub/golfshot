import asyncio
from sqlalchemy import select
import app.database as d
from app.models.db_models import Course

NAME = "MARGAS GOLF - Las Margas"

par = [4, 4, 4, 3, 4, 3, 5, 3, 5, 5, 4, 4, 3, 4, 4, 5, 3, 5]
si = [16, 9, 3, 8, 10, 14, 7, 13, 18, 11, 2, 1, 5, 12, 6, 15, 17, 4]

dist = {
    "Blancas":   [337, 315, 404, 207, 389, 192, 525, 198, 509, 481, 395, 434, 198, 366, 434, 500, 161, 559],
    "Amarillas": [305, 261, 366, 186, 305, 168, 494, 162, 479, 456, 342, 381, 178, 331, 404, 471, 151, 499],
    "Azules":    [284, 241, 343, 162, 293, 147, 466, 148, 451, 414, 342, 336, 165, 302, 380, 448, 133, 470],
    "Rojas":     [262, 226, 323, 139, 261, 125, 437, 124, 425, 372, 303, 334, 142, 278, 362, 426, 110, 440],
}

tees = [
    {"name": "Blancas", "slope": 140, "rating": 74.9},
    {"name": "Amarillas", "slope": 130, "rating": 71.5},
    {"name": "Azules", "slope": 127, "rating": 69.2},
    {"name": "Rojas", "slope": 117, "rating": 67.3},
]

holes_data = []
for i in range(18):
    holes_data.append({
        "number": i + 1,
        "par": par[i],
        "handicap": si[i],
        "distance": dist["Amarillas"][i],  # canonical (men's standard tee)
        "distances": {t: dist[t][i] for t in dist},
    })


async def main():
    d.init_engine()
    async with d.async_session_factory() as s:
        existing = (await s.execute(select(Course).where(Course.name == NAME))).scalar_one_or_none()
        if existing:
            print("ALREADY EXISTS:", existing.id)
            return
        c = Course(name=NAME, holes=18, par=72, tees=tees, holes_data=holes_data, is_favorite=False)
        s.add(c)
        await s.commit()
        await s.refresh(c)
        print("CREATED:", c.id, "| tees:", [t["name"] for t in c.tees], "| holes:", len(c.holes_data))

asyncio.run(main())
