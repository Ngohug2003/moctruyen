"""Initial explicit Mộc schema; content IDs preserve existing readers."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "books",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
    )
    op.create_table(
        "chapters",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("book_id", sa.String(16), sa.ForeignKey("books.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.UniqueConstraint("book_id", "position"),
        sa.UniqueConstraint("book_id", "id"),
    )
    op.create_index("ix_chapters_book_id", "chapters", ["book_id"])
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "login_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "progress",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("book_id", sa.String(16), sa.ForeignKey("books.id"), primary_key=True),
        sa.Column("chapter_id", sa.String(16), sa.ForeignKey("chapters.id"), nullable=False),
        sa.Column("ratio", sa.Float(), nullable=False),
        sa.Column("pixel", sa.Float(), nullable=False),
        sa.Column("location_kind", sa.String(8), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("ratio >= 0 AND ratio <= 1"),
        sa.CheckConstraint("pixel >= 0"),
    )


def downgrade():
    for table in ["progress", "login_sessions", "users", "chapters", "books"]:
        op.drop_table(table)
