from app.repositories import catalog
from app.repositories import cultivation as repo
from app.schemas.responses.cultivation import CultivationOut
from app.utils.errors import DomainError


async def get_guide(db, book_id):
    guide = await repo.guide(db, book_id)
    if not guide:
        raise DomainError(404, "CULTIVATION_NOT_FOUND", "Truyện này chưa có bảng cảnh giới.")
    systems = await repo.systems(db, book_id)
    realms = await repo.realms(db, [system.id for system in systems])
    return CultivationOut(
        book_id=book_id,
        title=guide.title,
        version=guide.version,
        updated_at=guide.updated_at,
        intro=guide.intro,
        source_note=guide.source_note,
        sources=guide.sources,
        systems=[
            dict(
                id=s.id,
                position=s.position,
                title=s.title,
                summary=s.summary,
                verification=s.verification,
                source_ids=s.source_ids,
                realms=[r for r in realms if r.system_id == s.id],
            )
            for s in systems
        ],
    )


async def import_guide(db, body):
    if not await catalog.book(db, body.book_id):
        raise ValueError("Seed the book before its cultivation guide")
    source_ids = {source.id for source in body.sources}
    if len(source_ids) != len(body.sources):
        raise ValueError("Duplicate source ID")
    ids = set()
    for position, system in enumerate(body.systems):
        if system.position != position or system.id in ids:
            raise ValueError("Invalid system ordering")
        ids.add(system.id)
        for entry_position, entry in enumerate(system.realms):
            if entry.position != entry_position or entry.id in ids:
                raise ValueError("Invalid realm ordering")
            ids.add(entry.id)
            if not set(entry.source_ids) <= source_ids:
                raise ValueError("Unknown realm source")
        if not set(system.source_ids) <= source_ids:
            raise ValueError("Unknown system source")
    return await repo.replace(db, body)
