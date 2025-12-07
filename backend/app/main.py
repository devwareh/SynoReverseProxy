"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import config first to ensure .env is loaded
from app.core import config  # noqa: F401
from app.core.version import APP_VERSION, VERSION_INFO

from app.api.routes import rules, import_export, auth

app = FastAPI(
    title="Synology Reverse Proxy Manager API",
    description="API for managing Synology NAS reverse proxy rules",
    version=APP_VERSION
)

# CORS middleware
# When using credentials (cookies), we cannot use wildcard "*" for origins
# We need to specify allowed origins explicitly
import os

# Check if we're in development mode
is_development = os.getenv("ENVIRONMENT", "development").lower() != "production"

# Base allowed origins (always allowed)
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://0.0.0.0:3000",
]

# Add any additional origins from environment variable (comma-separated)
extra_origins = os.getenv("CORS_ORIGINS", "")
if extra_origins:
    allowed_origins.extend([origin.strip() for origin in extra_origins.split(",")])

# In development, also allow local network IP addresses using regex
# This allows access from other devices on the same network (e.g., 192.168.0.210:3000)
allow_origin_regex = None
if is_development:
    # Allow any IP in private network ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    # on common development ports (3000, 3001)
    # Pattern: http:// or https:// followed by private IP, then :3000 or :3001
    allow_origin_regex = r"https?://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|localhost|127\.0\.0\.1|0\.0\.0\.0):(3000|3001)"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Note: import_export routes must come before rules routes to match /rules/export before /rules/{rule_id}
app.include_router(auth.router)  # Auth routes first
app.include_router(import_export.router)
app.include_router(rules.router)


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Synology Reverse Proxy API Ready!",
        "version": APP_VERSION
    }


@app.get("/version")
def get_version():
    """Get application version information."""
    return VERSION_INFO


# Backward compatibility endpoint
@app.post("/create")
def create_rule_legacy(rule):
    """Legacy endpoint for creating rules. Use POST /rules instead."""
    from app.api.routes.rules import create_rule
    from app.api.dependencies import get_mgr
    from app.models.schemas import ReverseProxyRule
    
    # Convert dict to ReverseProxyRule if needed
    if isinstance(rule, dict):
        rule = ReverseProxyRule(**rule)
    return create_rule(rule, get_mgr())

