from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "202610040001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    constraints = [
        sa.CheckConstraint("quantity between 1 and 25", name="cart_items_quantity_bounds"),
        sa.PrimaryKeyConstraint("user_id", "product_id", name="pk_cart_items"),
    ]
    if bind.dialect.name == "postgresql":
        constraints.append(sa.ForeignKeyConstraint(
            ["user_id"], ["auth.users.id"], ondelete="CASCADE", name="fk_cart_items_auth_user"
        ))
    op.create_table(
        "cart_items",
        sa.Column("user_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("product_id", sa.String(length=80), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        *constraints,
    )

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE public.cart_items REPLICA IDENTITY FULL")
        op.execute(
            "CREATE POLICY cart_items_select_own ON public.cart_items "
            "FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)"
        )
        op.execute("REVOKE ALL ON public.cart_items FROM anon, authenticated")
        op.execute("GRANT SELECT ON public.cart_items TO authenticated")
        op.execute(
            "DO $$ BEGIN "
            "IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN "
            "RAISE EXCEPTION 'Supabase Realtime publication supabase_realtime is missing'; "
            "END IF; "
            "IF NOT EXISTS (SELECT 1 FROM pg_publication_tables "
            "WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cart_items') THEN "
            "ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_items; "
            "END IF; END $$"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "DO $$ BEGIN "
            "IF EXISTS (SELECT 1 FROM pg_publication_tables "
            "WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cart_items') THEN "
            "ALTER PUBLICATION supabase_realtime DROP TABLE public.cart_items; "
            "END IF; END $$"
        )
        op.execute("DROP POLICY IF EXISTS cart_items_select_own ON public.cart_items")
    op.drop_table("cart_items")