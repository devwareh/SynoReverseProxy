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
