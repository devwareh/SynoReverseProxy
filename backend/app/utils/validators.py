"""Shared input validators."""
import re

UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


def is_valid_uuid(value: str) -> bool:
    """Return True if value matches standard UUID format."""
    return bool(UUID_RE.match(value))
