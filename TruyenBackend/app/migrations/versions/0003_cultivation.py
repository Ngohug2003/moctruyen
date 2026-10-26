"""Versioned book cultivation guides, ordered systems and realm branches."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cultivation_guides",
        sa.Column(
            "book_id",
            sa.String(16),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("updated_at", sa.String(10), nullable=False),
        sa.Column("intro", sa.Text(), nullable=False),
        sa.Column("source_note", sa.Text(), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
    )
    op.create_table(
        "realm_systems",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column(
            "book_id",
            sa.String(16),
            sa.ForeignKey("cultivation_guides.book_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("verification", sa.String(200), nullable=False),
        sa.Column("source_ids", sa.JSON(), nullable=False),
        sa.UniqueConstraint("book_id", "position"),
    )
    op.create_index("ix_realm_systems_book_id", "realm_systems", ["book_id"])
    op.create_table(
        "cultivation_realms",
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column(
            "system_id",
            sa.String(100),
            sa.ForeignKey("realm_systems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("branch", sa.String(100), nullable=False),
        sa.Column("aliases", sa.JSON(), nullable=False),
        sa.Column("source_ids", sa.JSON(), nullable=False),
        sa.UniqueConstraint("system_id", "position"),
    )
    op.create_index("ix_cultivation_realms_system_id", "cultivation_realms", ["system_id"])


def downgrade():
    op.drop_table("cultivation_realms")
    op.drop_table("realm_systems")
    op.drop_table("cultivation_guides")
