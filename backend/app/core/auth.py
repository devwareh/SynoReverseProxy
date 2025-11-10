"""Authentication and session management for Synology DSM API."""
import time
import requests
from typing import Optional, Dict, Any
from app.core.config import get_settings
from app.utils.encryption import save_session, load_session


def get_new_session(device_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Authenticate with Synology DSM API v6.
    
    Args:
        device_id: Optional device ID to skip OTP for subsequent logins
        
    Returns:
        Dictionary containing sid, did, synotoken, and expiry_time
    """
    settings = get_settings()
    login_url = f"{settings.synology_nas_url}/webapi/entry.cgi"
    params = {
        "api": "SYNO.API.Auth",
        "method": "login",
        "version": "6",
        "account": settings.synology_username,
        "passwd": settings.synology_password,
        "session": "Core",
        "format": "sid",
        "enable_syno_token": "yes"
    }
    
    # If device_id exists, use it to skip OTP
    if device_id:
        params["device_name"] = settings.synology_device_name
        params["device_id"] = device_id
    else:
        # First login: use OTP if provided and enable device token
        if settings.synology_otp_code:
            params["otp_code"] = settings.synology_otp_code
            params["enable_device_token"] = "yes"
            params["device_name"] = settings.synology_device_name
    
    session = requests.Session()
    resp = session.get(login_url, params=params, verify=False)
    resp.raise_for_status()
    result = resp.json()
    
    if not result.get('success'):
        raise Exception(f"Login failed: {result}")
    
    data = result["data"]
    sid = data["sid"]
    did = data.get("did")
    synotoken = data.get("synotoken")
    expiry_time = time.time() + settings.synology_session_expiry_secs
    
    save_session(sid, did, synotoken, expiry_time)
    
    return {
        'sid': sid,
        'did': did,
        'synotoken': synotoken,
        'expiry_time': expiry_time
    }


def is_session_valid(sid: str, synotoken: Optional[str] = None) -> bool:
    """
    Validate session by checking if SID is still valid.
    
    Args:
        sid: Session ID to validate
        synotoken: Optional SynoToken for CSRF protection
        
    Returns:
        True if session is valid, False otherwise
    """
    settings = get_settings()
    check_url = f"{settings.synology_nas_url}/webapi/entry.cgi"
    params = {
        "api": "SYNO.Core.System",
        "method": "info",
        "version": "1",
        "_sid": sid
    }
    if synotoken:
        params["SynoToken"] = synotoken
    
    try:
        resp = requests.get(check_url, params=params, verify=False, timeout=10)
        result = resp.json()
        return result.get('success', False)
    except Exception:
        return False

