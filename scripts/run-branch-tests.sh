#!/usr/bin/env bash
# Branch test runner — builds from source and validates all phases
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/backend/config/.env"
OVERRIDE_FILE="$REPO_ROOT/docker-compose.test-override.yml"
BACKEND_IMAGE="syno-test-backend"
FRONTEND_IMAGE="syno-test-frontend"
BACKEND_PORT="${BACKEND_PORT:-18888}"
FRONTEND_PORT="${FRONTEND_PORT:-8889}"

# Result tracking (bash 3.x compatible — no associative arrays)
RESULT_build_backend="SKIP"
RESULT_build_frontend="SKIP"
RESULT_unit_tests="SKIP"
RESULT_frontend_tests="SKIP"
RESULT_stack_launch="SKIP"
RESULT_health_checks="SKIP"
RESULT_nas_smoke="SKIP"

PHASES=(
  "build_backend"
  "build_frontend"
  "unit_tests"
  "frontend_tests"
  "stack_launch"
  "health_checks"
  "nas_smoke"
)

pass() { eval "RESULT_${1}=PASS"; }
fail() { eval "RESULT_${1}=FAIL"; }
get_result() { eval "echo \"\$RESULT_${1}\""; }

cleanup() {
  echo ""
  echo "Cleaning up..."
  if [ -f "$OVERRIDE_FILE" ]; then
    docker-compose -f "$REPO_ROOT/docker-compose.yml" \
      -f "$OVERRIDE_FILE" down --remove-orphans 2>/dev/null || true
    rm -f "$OVERRIDE_FILE"
  fi
}
trap cleanup EXIT

# ── Phase 0: Pre-flight ─────────────────────────────────────────────────────
echo "==> Phase 0: Pre-flight"

if [ ! -f "$ENV_FILE" ]; then
  echo "  ✗ Missing $ENV_FILE — cannot continue"
  exit 1
fi

# Source env without printing values
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if ! docker info > /dev/null 2>&1; then
  echo "  ✗ Docker is not running"
  exit 1
fi
echo "  ✓ Docker running"

NAS_HOST=$(echo "${SYNOLOGY_NAS_URL:-}" | sed 's|https\?://||' | cut -d: -f1)
NAS_PORT=$(echo "${SYNOLOGY_NAS_URL:-}" | sed 's|.*:||')
if [ -n "$NAS_HOST" ]; then
  if curl -s --connect-timeout 3 "${SYNOLOGY_NAS_URL}" > /dev/null 2>&1; then
    echo "  ✓ NAS reachable at ${SYNOLOGY_NAS_URL}"
  else
    echo "  ⚠ NAS not reachable — Phase 6 (NAS smoke) will likely fail"
  fi
fi

# ── Phase 1: Build images from source ──────────────────────────────────────
echo ""
echo "==> Phase 1: Build Docker images from source"

echo "  Building backend..."
if docker build -q \
    --build-arg BACKEND_PORT="${BACKEND_PORT}" \
    -t "$BACKEND_IMAGE" \
    "$REPO_ROOT/backend"; then
  echo "  ✓ Backend image built: $BACKEND_IMAGE"
  pass "build_backend"
else
  echo "  ✗ Backend build failed"
  fail "build_backend"
  echo "  Cannot proceed without backend image."
  exit 1
fi

echo "  Building frontend..."
if docker build -q \
    --build-arg BACKEND_PORT="${BACKEND_PORT}" \
    --build-arg NGINX_PORT="${FRONTEND_PORT}" \
    -t "$FRONTEND_IMAGE" \
    "$REPO_ROOT/frontend"; then
  echo "  ✓ Frontend image built: $FRONTEND_IMAGE"
  pass "build_frontend"
else
  echo "  ✗ Frontend build failed"
  fail "build_frontend"
  echo "  Cannot proceed without frontend image."
  exit 1
fi

# ── Phase 2: Backend unit tests ─────────────────────────────────────────────
echo ""
echo "==> Phase 2: Backend unit tests (pytest)"

PYTEST_OUTPUT=$(mktemp)
# Writable shadow dirs so tests can write without touching the source tree
CONFIG_TMP=$(mktemp -d)
DATA_TMP=$(mktemp -d)
# Seed config shadow with existing config files (e.g. .web_auth.json, .env)
find "$REPO_ROOT/backend/config" -maxdepth 1 -type f -exec cp {} "$CONFIG_TMP/" \; 2>/dev/null || true
if docker run --rm \
    -v "$REPO_ROOT:/app:ro" \
    -v "$CONFIG_TMP:/app/backend/config" \
    -v "$DATA_TMP:/app/backend/data" \
    "$BACKEND_IMAGE" \
    sh -c "pip install pytest --quiet && pytest tests/ -v --tb=short" 2>&1 | tee "$PYTEST_OUTPUT"; then
  echo "  ✓ All backend tests passed"
  pass "unit_tests"
else
  echo "  ✗ Backend tests failed (see output above)"
  fail "unit_tests"
fi
rm -f "$PYTEST_OUTPUT"
rm -rf "$CONFIG_TMP" "$DATA_TMP"

# ── Phase 3: Frontend tests ──────────────────────────────────────────────────
echo ""
echo "==> Phase 3: Frontend tests (npm test)"

if docker run --rm \
    -v "$REPO_ROOT/frontend:/app" \
    -w /app \
    --env CI=true \
    node:18-alpine \
    sh -c "npm ci --silent && npm test -- --watchAll=false --passWithNoTests"; then
  echo "  ✓ Frontend tests passed"
  pass "frontend_tests"
else
  echo "  ✗ Frontend tests failed"
  fail "frontend_tests"
fi

# ── Phase 4: Stack launch ────────────────────────────────────────────────────
echo ""
echo "==> Phase 4: Stack launch"

# Write override file that swaps published images for local builds
cat > "$OVERRIDE_FILE" <<OVERRIDE_EOF
version: '3.8'
services:
  backend:
    image: ${BACKEND_IMAGE}
    build: ~
  frontend:
    image: ${FRONTEND_IMAGE}
    build: ~
OVERRIDE_EOF

# Export required env vars for docker-compose interpolation
export SYNOLOGY_NAS_URL SYNOLOGY_USERNAME SYNOLOGY_PASSWORD
export BACKEND_PORT FRONTEND_PORT

cd "$REPO_ROOT"
if docker-compose \
    -f docker-compose.yml \
    -f "$OVERRIDE_FILE" \
    up -d --no-build; then
  echo "  ✓ Stack started"
  pass "stack_launch"
else
  echo "  ✗ Stack failed to start"
  fail "stack_launch"
fi
