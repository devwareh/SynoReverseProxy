"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import config first to ensure .env is loaded
from app.core import config  # noqa: F401

from app.api.routes import rules, import_export, auth

app = FastAPI(
    title="Synology Reverse Proxy Manager API",
    description="API for managing Synology NAS reverse proxy rules",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for demo, restrict for prod!
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
    return {"message": "Synology Reverse Proxy API Ready!"}


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

