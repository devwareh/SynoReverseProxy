"""Encryption utilities for session management."""
import os
import json
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from app.core.config import KEY_FILE, SESSION_FILE


def load_or_generate_key() -> bytes:
    """Load existing encryption key or generate a new one."""
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, 'rb') as f:
            return f.read()
    key = Fernet.generate_key()
    with open(KEY_FILE, 'wb') as f:
        f.write(key)
    return key


# Initialize Fernet with the key
FERNET = Fernet(load_or_generate_key())


def save_session(sid: str, did: Optional[str], synotoken: Optional[str], expiry_time: float):
    """Save session data including SID, device ID, and SynoToken."""
    data = {
        'sid': sid,
        'did': did,
        'synotoken': synotoken,
        'expiry_time': expiry_time
    }
    encrypted = FERNET.encrypt(json.dumps(data).encode('utf-8'))
    with open(SESSION_FILE, 'wb') as f:
        f.write(encrypted)


def load_session() -> Optional[Dict[str, Any]]:
    """Load session data including SID, device ID, and SynoToken."""
    if not os.path.exists(SESSION_FILE):
        return None
    try:
        import time
        with open(SESSION_FILE, 'rb') as f:
            decrypted = FERNET.decrypt(f.read())
        data = json.loads(decrypted)
        sid = data.get('sid')
        expiry = data.get('expiry_time')
        if not sid or (expiry and time.time() > expiry):
            return None
        return {
            'sid': sid,
            'did': data.get('did'),
            'synotoken': data.get('synotoken'),
            'expiry_time': expiry
        }
    except Exception:
        return None
