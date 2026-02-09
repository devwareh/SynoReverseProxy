"""Web UI authentication and session management."""
import bcrypt
import secrets
import time
import json
from typing import Dict, Any, Optional
from collections import defaultdict
from app.core.config import CONFIG_DIR, DATA_DIR
from app.utils.encryption import FERNET

# Session storage (persisted to disk, encrypted)
_sessions: Dict[str, Dict[str, Any]] = {}

# Rate limiting: track failed login attempts per IP/username
_failed_attempts: Dict[str, list] = defaultdict(list)

# Web auth file path
WEB_AUTH_FILE = CONFIG_DIR / ".web_auth.json"
# Web sessions file path (encrypted, stored in data directory)
WEB_SESSIONS_FILE = DATA_DIR / "web_sessions.json.enc"


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
    save_web_sessions()
    
    return True


def load_web_sessions() -> Dict[str, Dict[str, Any]]:
    """Load web UI sessions from encrypted file."""
    if not WEB_SESSIONS_FILE.exists():
        return {}
    
    try:
        with open(WEB_SESSIONS_FILE, 'rb') as f:
            encrypted_data = f.read()
        
        if not encrypted_data:
            return {}
        
        decrypted = FERNET.decrypt(encrypted_data)
        sessions_data = json.loads(decrypted)
        
        # Validate and filter expired sessions
        now = time.time()
        valid_sessions = {}
        for session_id, session_info in sessions_data.items():
            expires_at = session_info.get('expires_at', 0)
            if expires_at > now:
                valid_sessions[session_id] = session_info
        
        return valid_sessions
    except Exception:
        # If file is corrupted or invalid, return empty dict
        # File will be recreated on next save
        return {}


def save_web_sessions():
    """Save web UI sessions to encrypted file."""
    try:
        # Ensure data directory exists
        DATA_DIR.mkdir(exist_ok=True, mode=0o755)
        
        # Encrypt sessions data
        sessions_json = json.dumps(_sessions)
        encrypted = FERNET.encrypt(sessions_json.encode('utf-8'))
        
        # Write to file
        with open(WEB_SESSIONS_FILE, 'wb') as f:
            f.write(encrypted)
        
        # Set file permissions to 600 (read/write for owner only)
        try:
            WEB_SESSIONS_FILE.chmod(0o600)
        except Exception:
            pass  # Ignore permission errors on some systems
    except Exception:
        # Log error but don't fail - sessions will be lost but app continues
        import logging
        logger = logging.getLogger(__name__)
        logger.error("Failed to save web sessions", exc_info=True)


def cleanup_expired_sessions():
    """Remove expired sessions from memory and disk."""
    now = time.time()
    expired_ids = []
    
    for session_id, session_info in _sessions.items():
        expires_at = session_info.get('expires_at', 0)
        if expires_at <= now:
            expired_ids.append(session_id)
    
    for session_id in expired_ids:
        del _sessions[session_id]
    
    # Save cleaned sessions to disk
    if expired_ids:
        save_web_sessions()


def delete_all_sessions():
    """Delete all sessions (useful for password change)."""
    _sessions.clear()
    save_web_sessions()


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
    
    # Persist to disk
    save_web_sessions()
    
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
        save_web_sessions()
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
        save_web_sessions()


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


# Load sessions from disk on module initialization
_sessions = load_web_sessions()

# Clean up expired sessions on startup
cleanup_expired_sessions()

