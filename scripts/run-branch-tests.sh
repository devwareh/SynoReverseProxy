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

# ── Phase 5: Health checks ────────────────────────────────────────────────────
echo ""
echo "==> Phase 5: Health checks"

wait_for_http() {
  local url="$1"
  local label="$2"
  local max_wait=30
  local interval=3
  local elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -s --connect-timeout 2 "$url" > /dev/null 2>&1; then
      echo "  ✓ $label is up ($url)"
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
  done
  echo "  ✗ $label did not respond within ${max_wait}s ($url)"
  return 1
}

HEALTH_PASS=true
wait_for_http "http://localhost:${BACKEND_PORT}/" "Backend" || HEALTH_PASS=false
wait_for_http "http://localhost:${FRONTEND_PORT}/" "Frontend" || HEALTH_PASS=false

if [ "$HEALTH_PASS" = "true" ]; then
  pass "health_checks"
else
  fail "health_checks"
fi

# ── Phase 6: NAS smoke test ───────────────────────────────────────────────────
echo ""
echo "==> Phase 6: NAS smoke test (live auth)"

SMOKE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 \
  -X POST "http://localhost:${BACKEND_PORT}/auth/first-login" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "  /auth/first-login → HTTP $SMOKE_HTTP"

if [[ "$SMOKE_HTTP" =~ ^(200|400|401)$ ]]; then
  echo "  ✓ NAS smoke passed (got expected response from auth endpoint)"
  pass "nas_smoke"
else
  echo "  ✗ NAS smoke failed (unexpected HTTP $SMOKE_HTTP — expected 200/400/401)"
  fail "nas_smoke"
fi

# ── Phase 7: Report ───────────────────────────────────────────────────────────
echo ""
echo "==> Phase 7: Report"

PHASE_LABELS=(
  "build_backend:  Phase 1  Build (backend)    "
  "build_frontend: Phase 1  Build (frontend)   "
  "unit_tests:     Phase 2  Unit tests         "
  "frontend_tests: Phase 3  Frontend tests     "
  "stack_launch:   Phase 4  Stack launch       "
  "health_checks:  Phase 5  Health checks      "
  "nas_smoke:      Phase 6  NAS smoke          "
)

PASS_COUNT=0
FAIL_COUNT=0

echo ""
echo "╔════════════════════════════════════════╗"
echo "║        Branch Test Results             ║"
echo "╠════════════════════════════════════════╣"
for entry in "${PHASE_LABELS[@]}"; do
  key="${entry%%:*}"
  label="${entry#*:}"
  result=$(get_result "$key")
  if [ "$result" = "PASS" ]; then
    echo "║  ${label}  ✅ PASS  ║"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif [ "$result" = "FAIL" ]; then
    echo "║  ${label}  ❌ FAIL  ║"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "║  ${label}  ⏭  SKIP  ║"
  fi
done
echo "╚════════════════════════════════════════╝"
echo ""
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "Overall: ✅ PASS ($PASS_COUNT/${#PHASES[@]})"
  EXIT_CODE=0
else
  echo "Overall: ❌ FAIL ($PASS_COUNT passed, $FAIL_COUNT failed)"
  EXIT_CODE=1
fi

# Teardown is handled by the trap (cleanup function)
exit $EXIT_CODE
