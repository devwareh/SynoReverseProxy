"""API dependencies for dependency injection."""
from app.core.synology import SynoReverseProxyManager
from app.core.auth import get_new_session, is_session_valid
from app.core.config import get_settings
from app.utils.encryption import load_session


def get_mgr() -> SynoReverseProxyManager:
    """
    Get or create a SynoReverseProxyManager with valid session.
    Handles session validation and renewal with device tokens.
    
    Note: This will fail if no session exists and no device token is available.
    For first-time setup, use the /auth/first-login endpoint instead.
    """
    settings = get_settings()
    session_data = load_session()
    
    # If no session or session invalid, create new one
    if session_data is None or not is_session_valid(session_data['sid'], session_data.get('synotoken')):
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

