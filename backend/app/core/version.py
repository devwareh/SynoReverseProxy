"""
Application version information.

Version is read from the VERSION file at the project root.
Follow semantic versioning: MAJOR.MINOR.PATCH

- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)
"""

from pathlib import Path

# Read version from VERSION file at project root
VERSION_FILE = Path(__file__).parent.parent.parent.parent / "VERSION"

def _read_version() -> str:
    """Read version from VERSION file."""
    try:
        if VERSION_FILE.exists():
            return VERSION_FILE.read_text().strip()
    except Exception:
        pass
    # Fallback version if file cannot be read
    return "0.0.0"

# Application version
APP_VERSION = _read_version()

# Version metadata
VERSION_INFO = {
    "version": APP_VERSION,
    "api_version": APP_VERSION,  # API version matches app version
}






