#!/usr/bin/env bash
# Starts Postgres for local development. Docker Compose if Docker is installed,
# otherwise Homebrew's postgresql@16 — which is the usual case on a Mac that
# does not have Docker Desktop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

wait_for_postgres() {
  for _ in $(seq 1 40); do
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  echo "Postgres did not become ready on localhost:5432." >&2
  return 1
}

ensure_role_and_database() {
  # Homebrew (and most local installs) authenticate the current OS user over
  # the Unix socket as a superuser, which is how we can create the app role
  # without already knowing a postgres password.
  local psql_cmd=(psql postgres --set ON_ERROR_STOP=1)

  "${psql_cmd[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studentproj') THEN
    CREATE ROLE studentproj LOGIN PASSWORD 'studentproj' CREATEDB;
  ELSE
    ALTER ROLE studentproj WITH LOGIN PASSWORD 'studentproj' CREATEDB;
  END IF;
END
$$;
SQL

  local exists
  exists="$("${psql_cmd[@]}" -tAc "SELECT 1 FROM pg_database WHERE datname = 'studentproj'")"
  if [[ "$exists" != "1" ]]; then
    createdb -O studentproj studentproj
  fi
}

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Using Docker Compose for Postgres."
  docker compose up -d
  wait_for_postgres
  echo "Postgres is ready on localhost:5432."
  exit 0
fi

if command -v brew >/dev/null 2>&1; then
  echo "Docker is not installed; using Homebrew postgresql@16."
  if ! brew list postgresql@16 >/dev/null 2>&1; then
    brew install postgresql@16
  fi

  prefix="$(brew --prefix postgresql@16)"
  export PATH="$prefix/bin:$PATH"

  brew services start postgresql@16 >/dev/null
  wait_for_postgres
  ensure_role_and_database
  echo "Postgres is ready on localhost:5432 (user/password/database: studentproj)."
  echo "Add this to your shell if createdb/psql are not on PATH:"
  echo "  export PATH=\"$prefix/bin:\$PATH\""
  exit 0
fi

cat >&2 <<'EOF'
Need Postgres on localhost:5432, and Docker is not installed.

On macOS with Homebrew:
  brew install postgresql@16
  brew services start postgresql@16
  export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
  psql postgres -c "CREATE ROLE studentproj LOGIN PASSWORD 'studentproj' CREATEDB;"
  createdb -O studentproj studentproj

Or install Docker Desktop and re-run this script.
EOF
exit 1
