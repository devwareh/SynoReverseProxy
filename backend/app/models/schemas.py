"""Pydantic models for request/response schemas."""
from pydantic import BaseModel
from typing import Optional, List


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
    acl: Optional[dict] = None

