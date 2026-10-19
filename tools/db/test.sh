#!/bin/sh
# Apply the Supabase migrations to a throwaway local Postgres and run the RLS tests.
#   sh tools/db/test.sh
set -e
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
DIR=$(mktemp -d); PORT=55432
cd "$(dirname "$0")/../.."
chown -R postgres "$DIR" 2>/dev/null || true
run() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/sh -c "$*"; else sh -c "$*"; fi; }
run "$BIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
run "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log start -w >/dev/null"
trap 'run "$BIN/pg_ctl -D $DIR/data stop -m fast >/dev/null"; rm -rf "$DIR"' EXIT
P="psql -X -q -h $DIR -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1"
$P -f tools/db/auth_stub.sql
for f in supabase/migrations/*.sql; do $P -f "$f"; done
$P -t -A -f tools/db/rls_test.sql >/dev/null
$P -t -A -f tools/db/devices_test.sql | tail -1
