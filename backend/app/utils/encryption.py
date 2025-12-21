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
    """Load session data including SID, device ID, and SynoToken.
    
    Even if the session expires, the device_id (DID) is preserved
    so it can be used to get a new session without OTP.
    """
    if not os.path.exists(SESSION_FILE):
        return None
    try:
        import time
        with open(SESSION_FILE, 'rb') as f:
            decrypted = FERNET.decrypt(f.read())
        data = json.loads(decrypted)
        sid = data.get('sid')
        did = data.get('did')  # Extract device_id - this is permanent
        synotoken = data.get('synotoken')
        expiry = data.get('expiry_time')
        
        # Check if session is valid
        is_valid = sid and (not expiry or time.time() <= expiry)
        
        if is_valid:
            # Session is valid, return everything
            return {
                'sid': sid,
                'did': did,
                'synotoken': synotoken,
                'expiry_time': expiry
            }
        elif did:
            # Session expired but we have device_id - preserve it for OTP-less login
            return {
                'sid': None,
                'did': did,
                'synotoken': None,
                'expiry_time': None
            }
        else:
            # No valid session and no device_id
            return None
    except Exception:
        return None
