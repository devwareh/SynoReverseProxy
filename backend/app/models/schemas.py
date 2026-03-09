"""Pydantic models for request/response schemas."""
import ipaddress
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

from app.utils.validators import UUID_RE


class AclRule(BaseModel):
    """A single allow/deny entry in an ACL profile."""
    access: bool
    address: str

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if v == "":
            return v  # empty string = catch-all, allowed by Synology
        try:
            ipaddress.ip_network(v, strict=False)
        except ValueError:
            raise ValueError(f"Invalid IP address or CIDR notation: {v!r}")
        return v


class AclProfile(BaseModel):
    """ACL profile for creating or updating an access control profile."""
    name: str = Field(min_length=1, max_length=64)
    rules: List[AclRule] = []

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Profile name must not be blank or whitespace only")
        return stripped


class ReverseProxyRule(BaseModel):
    """Reverse proxy rule schema."""
    description: str
    backend_fqdn: str
    backend_port: int
    frontend_fqdn: str
    frontend_port: int = 443
    customize_headers: Optional[List[dict]] = []
    frontend_hsts: bool = False
    backend_protocol: int = 0
    frontend_protocol: int = 1
    proxy_connect_timeout: int = 60
    proxy_read_timeout: int = 60
    proxy_send_timeout: int = 60
    proxy_http_version: int = 1
    proxy_intercept_errors: bool = False
    acl: Optional[str] = None

    @field_validator("acl")
    @classmethod
    def validate_acl(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not UUID_RE.match(v):
            raise ValueError("acl must be a valid UUID or null")
        return v

