CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'family'
    CHECK (role IN ('superadmin', 'manager', 'employee', 'family')),
  account_type TEXT NOT NULL DEFAULT 'family'
    CHECK (account_type IN ('family', 'business')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  can_create_users BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'family'
    CHECK (scope IN ('family', 'business')),
  category TEXT NOT NULL DEFAULT 'অন্যান্য',
  item_name TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'পিস',
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  expense_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_scope ON expenses (scope);

CREATE OR REPLACE VIEW expenses_detailed AS
SELECT
  e.id,
  e.user_id,
  u.name AS user_name,
  e.scope,
  e.category,
  e.item_name,
  e.quantity,
  e.unit,
  e.unit_price,
  e.total,
  e.expense_date,
  e.note,
  e.created_at,
  e.updated_at
FROM expenses e
JOIN users u ON u.id = e.user_id;
