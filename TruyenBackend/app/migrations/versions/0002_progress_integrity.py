"""Enforce chapter membership at the database boundary too."""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_foreign_key(
        "fk_progress_chapter_book",
        "progress",
        "chapters",
        ["book_id", "chapter_id"],
        ["book_id", "id"],
    )


def downgrade():
    op.drop_constraint("fk_progress_chapter_book", "progress", type_="foreignkey")
