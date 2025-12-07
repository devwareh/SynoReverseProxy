"""API dependencies for dependency injection."""
from fastapi import HTTPException, Cookie
from typing import Optional
from app.core.synology import SynoReverseProxyManager
from app.core.auth import get_new_session, is_session_valid
from app.core.config import get_settings
from app.core.web_auth import validate_session, get_session_username
from app.utils.encryption import load_session

# Cookie name for web session
SESSION_COOKIE_NAME = "web_session_id"


def get_current_user(session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME)) -> str:
    """
    Get current authenticated user from session cookie.
    
    Raises HTTPException(401) if not authenticated.
    """
    if not session_id or not validate_session(session_id):
        raise HTTPException(
            status_code=401,
            detail={
                "error": "authentication_required",
                "message": "Please log in to access this resource."
            }
        )
    
    username = get_session_username(session_id)
    if not username:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "authentication_required",
                "message": "Invalid session. Please log in again."
            }
        )
    
    return username


def get_mgr() -> SynoReverseProxyManager:
    """
    Get or create a SynoReverseProxyManager with valid session.
    Handles session validation and renewal with device tokens.
    
    Note: This will fail if no session exists and no device token is available.
    For first-time setup, use the /auth/first-login endpoint instead.
    """
    settings = get_settings()
    session_data = load_session()
    
    # Check if we have a valid session
    has_valid_session = (
        session_data is not None and 
        session_data.get('sid') and 
        is_session_valid(session_data['sid'], session_data.get('synotoken'))
    )
    
    if not has_valid_session:
        # Try to use device_id if available for OTP-less login
        device_id = session_data.get('did') if session_data else None
        if device_id:
            # We have a device token, can login without OTP
            session_data = get_new_session(device_id=device_id)
        else:
            # No device token - user needs to call /auth/first-login first
            from fastapi import HTTPException
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "authentication_required",
                    "message": "No valid session or device token found. Please call /auth/first-login endpoint to perform initial authentication.",
                    "requires_first_login": True
                }
            )
    
    return SynoReverseProxyManager(
        settings.synology_nas_url, 
        session_data['sid'], 
        synotoken=session_data.get('synotoken')
    )

