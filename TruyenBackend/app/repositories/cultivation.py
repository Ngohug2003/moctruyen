from sqlalchemy import delete, select

from app.models.cultivation import CultivationGuide, CultivationRealm, RealmSystem


async def guide(db, book_id):
    return await db.get(CultivationGuide, book_id)


async def systems(db, book_id):
    return (
        await db.scalars(
            select(RealmSystem)
            .where(RealmSystem.book_id == book_id)
            .order_by(RealmSystem.position, RealmSystem.id)
            .limit(30)
        )
    ).all()


async def realms(db, system_ids):
    return (
        await db.scalars(
            select(CultivationRealm)
            .where(CultivationRealm.system_id.in_(system_ids))
            .order_by(CultivationRealm.system_id, CultivationRealm.position, CultivationRealm.id)
            .limit(3000)
        )
    ).all()


async def replace(db, body):
    previous = await guide(db, body.book_id)
    if previous and previous.version == body.version:
        return False
    if previous:
        await db.execute(delete(CultivationGuide).where(CultivationGuide.book_id == body.book_id))
        await db.flush()
    values = body.model_dump()
    system_values = values.pop("systems")
    db.add(CultivationGuide(**values))
    await db.flush()
    for system in system_values:
        entries = system.pop("realms")
        db.add(RealmSystem(**system, book_id=body.book_id))
        await db.flush()
        db.add_all([CultivationRealm(**entry, system_id=system["id"]) for entry in entries])
    await db.flush()
    return True
