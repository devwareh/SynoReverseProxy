"""Web UI authentication and session management."""
import bcrypt
import secrets
import time
import json
from pathlib import Path
from typing import Optional, Dict, Any
from collections import defaultdict
from app.core.config import PROJECT_ROOT, CONFIG_DIR

# Session storage (in-memory for now, consider Redis for production)
_sessions: Dict[str, Dict[str, Any]] = {}

# Rate limiting: track failed login attempts per IP/username
_failed_attempts: Dict[str, list] = defaultdict(list)

# Web auth file path
WEB_AUTH_FILE = CONFIG_DIR / ".web_auth.json"


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def load_web_auth() -> Dict[str, Any]:
    """Load web authentication credentials from file."""
    if WEB_AUTH_FILE.exists():
        try:
            with open(WEB_AUTH_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    
    # Return empty dict if file doesn't exist
    return {}


def save_web_auth(username: str, password_hash: str):
    """Save web authentication credentials to file."""
    auth_data = {
        "username": username,
        "password_hash": password_hash,
        "created_at": time.time(),
        "updated_at": time.time()
    }
    
    # Ensure config directory exists
    CONFIG_DIR.mkdir(exist_ok=True, mode=0o755)
    
    # Write to file with restricted permissions
    with open(WEB_AUTH_FILE, 'w') as f:
        json.dump(auth_data, f, indent=2)
    
    # Set file permissions to 600 (read/write for owner only)
    try:
        WEB_AUTH_FILE.chmod(0o600)
    except Exception:
        pass  # Ignore permission errors on some systems


def initialize_web_auth(username: str, password: str, force_update: bool = False) -> bool:
    """Initialize web auth credentials if they don't exist.
    
    This ensures credentials are always available, even on first run.
    If credentials already exist, they are not overwritten unless force_update=True.
    
    Args:
        username: Username for authentication
        password: Password to hash and store
        force_update: If True, update existing credentials (use with caution)
    """
    auth_data = load_web_auth()
    
    if not auth_data or not auth_data.get('password_hash') or force_update:
        # No existing auth, or force update requested
        password_hash = hash_password(password)
        save_web_auth(username, password_hash)
        return True
    
    return False


def verify_web_credentials(username: str, password: str) -> bool:
    """Verify web UI credentials."""
    auth_data = load_web_auth()
    
    if not auth_data:
        return False
    
    stored_username = auth_data.get('username')
    stored_hash = auth_data.get('password_hash')
    
    if not stored_username or not stored_hash:
        return False
    
    if username != stored_username:
        return False
    
    return verify_password(password, stored_hash)


def update_password(current_password: str, new_password: str) -> bool:
    """Update web UI password."""
    auth_data = load_web_auth()
    
    if not auth_data:
        return False
    
    stored_username = auth_data.get('username')
    stored_hash = auth_data.get('password_hash')
    
    if not stored_username or not stored_hash:
        return False
    
    # Verify current password
    if not verify_password(current_password, stored_hash):
        return False
    
    # Validate new password
    if len(new_password) < 8:
        return False
    
    # Hash and save new password
    new_hash = hash_password(new_password)
    save_web_auth(stored_username, new_hash)
    
    # Invalidate all existing sessions (force re-login)
    _sessions.clear()
    
    return True


def delete_all_sessions():
    """Delete all sessions (useful for password change)."""
    _sessions.clear()


def create_session(username: str, remember_me: bool = False) -> str:
    """Create a new session and return session ID."""
    session_id = secrets.token_urlsafe(32)
    
    # Set expiry based on remember_me
    if remember_me:
        # 30 days for remember me
        expires_at = time.time() + (30 * 24 * 60 * 60)
    else:
        # Default 1 hour
        expires_at = time.time() + 3600
    
    _sessions[session_id] = {
        "username": username,
        "created_at": time.time(),
        "expires_at": expires_at,
        "remember_me": remember_me
    }
    
    return session_id


def validate_session(session_id: str) -> bool:
    """Validate if a session exists and is not expired."""
    if not session_id or session_id not in _sessions:
        return False
    
    session = _sessions[session_id]
    
    # Check if expired
    if time.time() > session["expires_at"]:
        # Remove expired session
        del _sessions[session_id]
        return False
    
    return True


def get_session_username(session_id: str) -> Optional[str]:
    """Get username from session."""
    if not session_id or session_id not in _sessions:
        return None
    
    if not validate_session(session_id):
        return None
    
    return _sessions[session_id]["username"]


def delete_session(session_id: str):
    """Delete a session."""
    if session_id in _sessions:
        del _sessions[session_id]


def check_rate_limit(identifier: str) -> bool:
    """Check if login attempts exceed rate limit.
    
    Args:
        identifier: IP address or username to check
        
    Returns:
        True if within rate limit, False if exceeded
    """
    from app.core.config import get_settings
    settings = get_settings()
    
    if not settings.app_rate_limit_enabled:
        return True
    
    now = time.time()
    window_start = now - settings.app_rate_limit_window
    
    # Clean old attempts
    _failed_attempts[identifier] = [
        attempt_time for attempt_time in _failed_attempts[identifier]
        if attempt_time > window_start
    ]
    
    # Check if limit exceeded
    if len(_failed_attempts[identifier]) >= settings.app_rate_limit_max_attempts:
        return False
    
    return True


def record_failed_attempt(identifier: str):
    """Record a failed login attempt."""
    _failed_attempts[identifier].append(time.time())


def clear_failed_attempts(identifier: str):
    """Clear failed attempts for an identifier (on successful login)."""
    if identifier in _failed_attempts:
        del _failed_attempts[identifier]

