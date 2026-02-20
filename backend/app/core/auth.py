"""Authentication and session management for Synology DSM API."""
import logging
import time
import requests
from typing import Optional, Dict, Any
from app.core.config import get_settings
from app.utils.encryption import save_session

_logger = logging.getLogger(__name__)


class SynologyAuthError(Exception):
    """Raised when the Synology DSM API rejects a login attempt with a structured error response."""

    def __init__(self, error_code: Optional[int], raw_response: dict):
        self.error_code = error_code
        self.raw_response = raw_response
        super().__init__(f"Synology authentication failed (code={error_code})")


def get_new_session(device_id: Optional[str] = None, otp_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Authenticate with Synology DSM API v6.

    Args:
        device_id: Optional device ID to skip OTP for subsequent logins
        otp_code: Optional OTP code for first login (overrides settings.synology_otp_code)

    Returns:
        Dictionary containing sid, did, synotoken, and expiry_time
    """
    settings = get_settings()
    if not settings.synology_ssl_verify:
        _logger.warning(
            "SSL certificate verification disabled (SYNOLOGY_SSL_VERIFY=false). "
            "Set SYNOLOGY_SSL_VERIFY=true if your NAS has a trusted certificate."
        )
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
        # Always try to enable device token on first login
        params["enable_device_token"] = "yes"
        params["device_name"] = settings.synology_device_name

        # Prefer the caller-supplied OTP; fall back to the settings value only as a
        # last resort.  SYNOLOGY_OTP_CODE is a static config knob — TOTP codes expire
        # after ~30 s so a value stored in .env will be stale on every restart after
        # the first.  Log a warning so the operator knows to remove it once the device
        # token has been established.
        effective_otp = otp_code if otp_code is not None else settings.synology_otp_code
        if effective_otp and otp_code is None and settings.synology_otp_code:
            _logger.warning(
                "Using SYNOLOGY_OTP_CODE from settings for authentication. "
                "TOTP codes expire in ~30 s — this will fail on restarts after initial setup. "
                "Remove SYNOLOGY_OTP_CODE from your .env once the device token is saved."
            )

        if effective_otp:
            params["otp_code"] = effective_otp

    session = requests.Session()
    resp = session.get(login_url, params=params, verify=settings.synology_ssl_verify)
    resp.raise_for_status()
    result = resp.json()

    if not result.get('success'):
        error = result.get('error')
        error_code = error.get('code') if isinstance(error, dict) else None
        _logger.debug("Synology login failed: code=%s", error_code)
        raise SynologyAuthError(error_code=error_code, raw_response=result)

    data = result["data"]
    sid = data["sid"]
    # If API returns a new DID, use it. Otherwise, keep the one we used to login.
    did = data.get("did") or device_id
    synotoken = data.get("synotoken")
    expiry_time = time.time() + settings.synology_session_expiry_secs

    save_session(sid, did, synotoken, expiry_time)

    return {
        'sid': sid,
        'did': did,
        'synotoken': synotoken,
        'expiry_time': expiry_time
    }


def is_session_valid(sid: Optional[str], synotoken: Optional[str] = None) -> bool:
    """
    Validate session by checking if SID is still valid.

    Args:
        sid: Session ID to validate (can be None if session expired but device token exists)
        synotoken: Optional SynoToken for CSRF protection

    Returns:
        True if session is valid, False otherwise (also returns False if sid is None)
    """
    # If sid is None, session is not valid (but device token may still exist)
    if not sid:
        return False

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
        resp = requests.get(check_url, params=params, verify=settings.synology_ssl_verify, timeout=10)
        result = resp.json()
        return result.get('success', False)
    except Exception:
        return False
