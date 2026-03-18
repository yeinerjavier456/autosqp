"""Expand vehicle description to text

Revision ID: 7f4f9e2c1a10
Revises: 2138c956f1b5
Create Date: 2026-03-18 12:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f4f9e2c1a10'
down_revision: Union[str, Sequence[str], None] = '2138c956f1b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'vehicles',
        'description',
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'vehicles',
        'description',
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
