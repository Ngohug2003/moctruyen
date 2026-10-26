"""HTTP integration against a separate local PostgreSQL database."""

import os
import subprocess
import sys
from uuid import uuid4

from dotenv import load_dotenv

load_dotenv()
source = os.environ["DATABASE_URL"]
os.environ["DATABASE_URL"] = source.rsplit("/", 1)[0] + "/moc_test"
assert os.environ["DATABASE_URL"].endswith("/moc_test")

import pytest
from fastapi.testclient import TestClient

from app.constants.database import Session, engine
from app.main import app
from app.models.entities import Book, Chapter


@pytest.fixture(scope="module")
def client():
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize("path", ["/api/v1/auth/me", "/api/v1/reader/progress"])
def test_private_requires_identity(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_auth_catalog_progress_isolation(client):
    key = uuid4().hex
    book_id = key[:16]

    async def fixture():
        async with Session.begin() as db:
            db.add(Book(id=book_id, title="Test Unicode Đế Bá 🌿", total=51, version="test-v1"))
            await db.flush()
            db.add_all(
                [
                    Chapter(
                        id=(key[16:24] + f"{i:08x}"),
                        book_id=book_id,
                        position=i,
                        number=i // 2,
                        title=f"Chương {i}",
                        content="Nội dung 🌿\nĐoạn hai.",
                    )
                    for i in range(51)
                ]
            )
        await engine.dispose()

    client.portal.call(fixture)

    def signup(suffix):
        body = {"email": f"{key}{suffix}@example.com", "password": "Secret12345!", "name": "Reader"}
        response = client.post("/api/v1/auth/register", json=body)
        assert response.status_code == 201, response.text
        result = response.json()["data"]
        assert "password_hash" not in result["user"]
        return body, result, {"Authorization": "Bearer " + result["token"]}

    body, user, headers = signup("a")
    _, _, other = signup("b")
    assert client.post("/api/v1/auth/register", json=body).status_code == 409
    assert client.post("/api/v1/auth/register", json={**body, "is_admin": True}).status_code == 422
    assert (
        client.post(
            "/api/v1/auth/login",
            json={**{k: v for k, v in body.items() if k != "name"}, "password": "Wrong1234"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={k: v for k, v in body.items() if k != "name"}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/auth/me", headers=headers).json()["data"]["id"] == user["user"]["id"]
    first = client.get(f"/api/v1/public/books/{book_id}/chapters").json()["data"]
    second = client.get(f"/api/v1/public/books/{book_id}/chapters?page=2").json()["data"]
    assert len(first["items"]) == 50 and len(second["items"]) == 1
    assert first["items"][-1]["position"] == 49 and second["items"][0]["position"] == 50
    assert all("content" not in row for row in first["items"])
    assert client.get(f"/api/v1/public/books/{book_id}/chapters?page_size=101").status_code == 422
    detail = client.get(f"/api/v1/public/books/{book_id}/chapters/50").json()["data"]
    assert detail["content"] == "Nội dung 🌿\nĐoạn hai."
    progress = {
        "chapter_id": detail["id"],
        "version": "test-v1",
        "location_kind": "ratio",
        "location_value": 0.6,
        "expected_revision": 0,
    }
    saved = client.put(f"/api/v1/reader/progress/{book_id}", headers=headers, json=progress)
    assert saved.status_code == 200, saved.text
    assert saved.json()["data"]["revision"] == 1
    assert client.get("/api/v1/reader/progress", headers=other).json()["data"]["items"] == []
    assert (
        client.put(f"/api/v1/reader/progress/{book_id}", headers=headers, json=progress).status_code
        == 409
    )
    assert (
        client.put(
            f"/api/v1/reader/progress/{book_id}",
            headers=headers,
            json={**progress, "expected_revision": 1, "location_value": 2},
        ).status_code
        == 422
    )
    updated = client.put(
        f"/api/v1/reader/progress/{book_id}",
        headers=headers,
        json={**progress, "expected_revision": 1, "location_kind": "pixel", "location_value": 245},
    )
    assert updated.json()["data"]["ratio"] == 0
    assert updated.json()["data"]["pixel"] == 245
    assert (
        client.put(
            "/api/v1/reader/progress/0000000000000000",
            headers=headers,
            json={**progress, "expected_revision": 2},
        ).status_code
        == 404
    )
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_safe_validation_and_openapi(client):
    response = client.post("/api/v1/auth/register", json={"email": "bad", "password": "s"})
    assert response.status_code == 422
    assert response.json()["data"] is None
    assert "password" not in response.text
    assert "/api/v1/reader/progress/{book_id}" in client.get("/openapi.json").json()["paths"]
    assert client.get("/ready").status_code == 200


def test_cultivation_seed_public_contract_and_revision(client):
    import json
    from pathlib import Path

    from sqlalchemy import func, select

    from app.models.cultivation import RealmSystem
    from app.schemas.responses.cultivation import CultivationOut
    from app.services.cultivation import import_guide

    payload = json.loads(
        (Path(__file__).resolve().parents[1] / "data/cultivation/de-ba.json").read_text(
            encoding="utf-8"
        )
    )
    suffix = uuid4().hex[:8]
    book_id = uuid4().hex[:16]
    payload["book_id"] = book_id
    for system in payload["systems"]:
        system["id"] += "-" + suffix
        for entry in system["realms"]:
            entry["id"] += "-" + suffix
    guide = CultivationOut.model_validate(payload)

    async def prepare():
        async with Session.begin() as db:
            db.add(Book(id=book_id, title="Cultivation fixture", total=0, version="test"))
        async with Session.begin() as db:
            assert await import_guide(db, guide) is True
        async with Session.begin() as db:
            assert await import_guide(db, guide) is False
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(RealmSystem)
                    .where(RealmSystem.book_id == book_id)
                )
                == 7
            )
        invalid = guide.model_copy(deep=True)
        invalid.version += "-invalid"
        invalid.systems[0].realms[0].source_ids = ["missing-source"]
        try:
            async with Session.begin() as db:
                await import_guide(db, invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("Unknown source must be rejected")
        await engine.dispose()

    client.portal.call(prepare)
    response = client.get(f"/api/v1/public/books/{book_id}/cultivation")
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["version"] == guide.version
    assert len(data["systems"]) == 7
    assert sum(len(system["realms"]) for system in data["systems"]) == 68
    assert data["systems"][0]["realms"][0]["name"] == "Khấu Cung Cảnh"
    assert "Khấu Môn" in data["systems"][0]["realms"][0]["detail"]
    assert data["systems"][0]["realms"][1]["name"] == "Thác Cương Cảnh"
    assert "Ích Cung" in data["systems"][0]["realms"][3]["aliases"]
    assert "Tham khảo" in data["systems"][-1]["verification"]
    assert client.get("/api/v1/public/books/0000000000000000/cultivation").status_code == 404
    # This readonly endpoint never returns any chapter body or private user data.
    assert "content" not in data and "user_id" not in response.text


def test_admin_upload_flow(client):
    key = uuid4().hex[:12]
    body = {"email": f"uploader_{key}@example.com", "password": "Secret12345!", "name": "AdminUser"}
    reg_res = client.post("/api/v1/auth/register", json=body)
    assert reg_res.status_code == 201
    token = reg_res.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Unauthenticated request must return 401
    txt_content = (
        "Truyện Test Upload\n"
        "Chương 1: Khởi đầu mới\n"
        "Nội dung chương một tại Mộc.\n"
        "Chương 2: Bước ngoặt\n"
        "Nội dung chương hai tại Mộc.\n"
    ).encode("utf-8")

    unauth = client.post(
        "/api/v1/admin/books/upload",
        files={"file": ("test_novel.txt", txt_content, "text/plain")},
    )
    assert unauth.status_code == 401

    # 2. Upload valid txt file
    upload_res = client.post(
        "/api/v1/admin/books/upload",
        files={"file": ("test_novel.txt", txt_content, "text/plain")},
        data={"title": f"Bộ Truyện {key}"},
        headers=headers,
    )
    assert upload_res.status_code == 201, upload_res.text
    result = upload_res.json()["data"]
    book_id = result["id"]
    assert result["total"] == 2
    assert result["title"] == f"Bộ Truyện {key}"
    assert result["duration_seconds"] >= 0

    # 3. Check public API reflects imported book and chapters
    chapters_res = client.get(f"/api/v1/public/books/{book_id}/chapters")
    assert chapters_res.status_code == 200
    ch_data = chapters_res.json()["data"]
    assert ch_data["total"] == 2
    assert len(ch_data["items"]) == 2
    assert ch_data["items"][0]["title"] == "Chương 1: Khởi đầu mới"
    assert ch_data["items"][1]["title"] == "Chương 2: Bước ngoặt"

    ch1_detail = client.get(f"/api/v1/public/books/{book_id}/chapters/0")
    assert ch1_detail.status_code == 200
    assert ch1_detail.json()["data"]["content"] == "Nội dung chương một tại Mộc."

    # 4. Duplicate upload without overwrite returns 409
    dup_res = client.post(
        "/api/v1/admin/books/upload",
        files={"file": ("test_novel.txt", txt_content, "text/plain")},
        data={"title": f"Bộ Truyện {key}", "overwrite": "false"},
        headers=headers,
    )
    assert dup_res.status_code == 409

    # 5. Overwrite upload succeeds
    updated_txt = (
        "Chương 1: Cập nhật chương 1\n"
        "Nội dung mới của chương một.\n"
        "Chương 2: Cập nhật chương 2\n"
        "Nội dung mới của chương hai.\n"
        "Chương 3: Chương ba mới thêm\n"
        "Nội dung chương ba.\n"
    ).encode("utf-8")

    overwrite_res = client.post(
        "/api/v1/admin/books/upload",
        files={"file": ("test_novel.txt", updated_txt, "text/plain")},
        data={"title": f"Bộ Truyện {key}", "overwrite": "true"},
        headers=headers,
    )
    assert overwrite_res.status_code == 201
    assert overwrite_res.json()["data"]["total"] == 3

    # 6. Upload invalid file extension returns 400
    bad_ext = client.post(
        "/api/v1/admin/books/upload",
        files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
        headers=headers,
    )
    assert bad_ext.status_code == 400
