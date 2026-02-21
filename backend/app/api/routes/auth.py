"""API routes for authentication."""
import logging

from fastapi import APIRouter, HTTPException, Response, Request, Cookie
from pydantic import BaseModel
from typing import Optional, Dict, Tuple
from app.core.auth import is_session_valid, get_new_session, SynologyAuthError
from app.core.config import get_settings
from app.core.web_auth import (
    verify_web_credentials,
    create_session,
    validate_session,
    get_session_username,
    delete_session,
    update_password,
    check_rate_limit,
    record_failed_attempt,
    clear_failed_attempts
)
from app.utils.encryption import load_session

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])

# Cookie name for web session
SESSION_COOKIE_NAME = "web_session_id"

# Dispatch table: Synology DSM error code → (http_status, error_label, user_message, requires_otp)
# Reference: DSM Login Web API Guide (codes 400-410)
_SYNO_ERRORS: Dict[int, Tuple[int, str, str, bool]] = {
    400: (401, "Invalid credentials",
          "Username or password is incorrect. Please check your credentials.", False),
    401: (401, "Account disabled",
          "This account has been disabled. Please contact your administrator.", False),
    402: (403, "Permission denied",
          "This account does not have permission to access the API.", False),
    403: (400, "2FA authentication required",
          "Your account requires 2-factor authentication. Please provide an OTP code.", True),
    404: (400, "Invalid OTP code",
          "The provided OTP code is incorrect or expired. Please generate a new OTP code and try again.", True),
    406: (400, "2FA authentication required",
          "Your account requires 2-factor authentication. Please provide an OTP code.", True),
    407: (403, "IP blocked",
          "Your IP address has been blocked. Please contact your administrator.", False),
    408: (401, "Password expired",
          "Your password has expired and cannot be changed through this interface. Please contact your administrator.", False),
    409: (401, "Password expired",
          "Your password has expired. Please change it through DSM before using this application.", False),
    410: (401, "Password change required",
          "You must change your password through DSM before using this application.", False),
}


class FirstLoginRequest(BaseModel):
    """Request model for first login endpoint."""
    otp_code: Optional[str] = None


class LoginRequest(BaseModel):
    """Request model for web UI login."""
    username: str
    password: str
    remember_me: bool = False


class ChangePasswordRequest(BaseModel):
    """Request model for password change."""
    current_password: str
    new_password: str


class SetupRequest(BaseModel):
    """Request model for first-run setup."""
    username: Optional[str] = None
    password: str
    confirm_password: str


@router.post("/first-login")
def first_login(request: FirstLoginRequest, client_request: Request):
    """
    Perform first-time authentication with optional OTP.

    This endpoint is unauthenticated: it uses server-side NAS credentials to obtain
    a device token. Rate limiting is applied by client IP to prevent OTP brute-force.

    Handles both 2FA-enabled users (with OTP) and non-2FA users (without OTP).
    After successful login, the device token is saved for future logins.

    Args:
        request: FirstLoginRequest with optional otp_code
        client_request: Request (for client IP rate limiting)

    Returns:
        Success message with device token status
    """
    try:
        # Check if device token already exists
        existing_session = load_session()
        if existing_session and existing_session.get('did'):
            # Check if session is still valid (only if sid exists)
            sid = existing_session.get('sid')
            if sid and is_session_valid(sid, existing_session.get('synotoken')):
                return {
                    "success": True,
                    "message": "Device token already exists and session is valid. No login needed.",
                    "device_token_saved": True,
                    "requires_otp": False
                }

        # Rate limit by client IP to prevent OTP brute-force
        client_ip = client_request.client.host if client_request.client else "unknown"
        rate_limit_id = f"first_login:{client_ip}"
        if not check_rate_limit(rate_limit_id):
            raise HTTPException(
                status_code=429,
                detail={
                    "success": False,
                    "error": "Too many attempts",
                    "message": "Too many login attempts. Please try again later.",
                    "requires_otp": None,
                }
            )

        # Attempt first login with optional OTP
        try:
            # Try login with OTP if provided, or without OTP if not provided
            session_data = get_new_session(otp_code=request.otp_code)

            # Success - device token should be saved
            device_token_saved = session_data.get('did') is not None
            clear_failed_attempts(rate_limit_id)

            return {
                "success": True,
                "message": "First login successful. Device token saved." if device_token_saved else "First login successful.",
                "device_token_saved": device_token_saved,
                "requires_otp": False
            }

        except SynologyAuthError as auth_err:
            record_failed_attempt(rate_limit_id)
            error_code = auth_err.error_code
            _logger.warning(
                "/first-login NAS auth failed: code=%s otp_provided=%s",
                error_code, bool(request.otp_code),
            )

            if error_code in _SYNO_ERRORS:
                http_status, error_label, message, requires_otp = _SYNO_ERRORS[error_code]
                raise HTTPException(
                    status_code=http_status,
                    detail={
                        "success": False,
                        "error": error_label,
                        "message": message,
                        "requires_otp": requires_otp,
                    }
                )

            # Unknown error code — if OTP was provided, retry without it.
            # Guards against OTP being sent to a non-2FA account.
            if request.otp_code:
                try:
                    session_data = get_new_session(otp_code=None)
                    device_token_saved = session_data.get('did') is not None
                    return {
                        "success": True,
                        "message": "First login successful (2FA not enabled). Device token saved." if device_token_saved else "First login successful (2FA not enabled).",
                        "device_token_saved": device_token_saved,
                        "requires_otp": False,
                        "note": "OTP was provided but not required. Your account does not have 2FA enabled."
                    }
                except SynologyAuthError:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "success": False,
                            "error": "Authentication failed",
                            "message": "Login failed with and without OTP. Please verify your credentials and OTP code if 2FA is enabled.",
                            "requires_otp": None,
                        }
                    )

            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "error": "Authentication failed",
                    "message": f"Synology login failed (error code: {error_code if error_code is not None else 'unknown'}). Please verify your credentials.",
                    "requires_otp": None,
                }
            )
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "Internal server error",
                "message": f"An unexpected error occurred: {str(e)}"
            }
        )


@router.post("/login")
def web_login(request: LoginRequest, response: Response, client_request: Request):
    """
    Web UI login endpoint.
    
    Authenticates user with username/password and creates a session.
    Sets an HTTP-only cookie with the session ID.
    """
    try:
        settings = get_settings()
        
        # Get client identifier for rate limiting (use IP address)
        client_ip = client_request.client.host if client_request.client else "unknown"
        rate_limit_id = f"{client_ip}:{request.username}"
        
        # Check rate limiting
        if not check_rate_limit(rate_limit_id):
            raise HTTPException(
                status_code=429,
                detail={
                    "success": False,
                    "error": "Too many attempts",
                    "message": "Too many failed login attempts. Please try again later."
                }
            )
        
        # Verify credentials
        if not verify_web_credentials(request.username, request.password):
            # Record failed attempt
            record_failed_attempt(rate_limit_id)
            raise HTTPException(
                status_code=401,
                detail={
                    "success": False,
                    "error": "Invalid credentials",
                    "message": "Username or password is incorrect."
                }
            )
        
        # Clear failed attempts on successful login
        clear_failed_attempts(rate_limit_id)
        
        # Invalidate old sessions for this user (prevent session fixation)
        # Note: In production with Redis, you'd query by username
        # For now, we'll create a new session (old ones will expire naturally)
        
        # Create session
        session_id = create_session(request.username, request.remember_me)
        
        # Set cookie with session ID
        # Determine max_age based on remember_me
        max_age = 30 * 24 * 60 * 60 if request.remember_me else 3600  # 30 days or 1 hour
        
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_id,
            max_age=max_age,
            httponly=True,
            secure=settings.app_use_https,  # Use secure flag if HTTPS enabled
            samesite="lax",
            path="/"
        )
        
        return {
            "success": True,
            "message": "Login successful",
            "username": request.username,
            "remember_me": request.remember_me
        }
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": "Internal server error",
                "message": "An unexpected error occurred. Please try again."
            }
        )


@router.post("/logout")
def web_logout(request: Request, response: Response, session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME)):
    """
    Web UI logout endpoint.
    
    Deletes the session and clears the cookie.
    """
    if session_id:
        delete_session(session_id)
    
    # Clear cookie
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        samesite="lax"
    )
    
    return {
        "success": True,
        "message": "Logout successful"
    }


@router.get("/me")
def get_current_user(session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME)):
    """
    Get current authenticated user info.
    
    Returns user info if authenticated, 401 if not.
    """
    if not session_id or not validate_session(session_id):
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": "Not authenticated",
                "message": "No valid session found. Please log in."
            }
        )
    
    username = get_session_username(session_id)
    if not username:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": "Not authenticated",
                "message": "Invalid session."
            }
        )
    
    return {
        "success": True,
        "username": username,
        "authenticated": True
    }


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME)
):
    """
    Change web UI password.
    
    Requires authentication and current password verification.
    """
    # Verify user is authenticated
    if not session_id or not validate_session(session_id):
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": "Not authenticated",
                "message": "Please log in to change your password."
            }
        )
    
    # Validate new password
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Invalid password",
                "message": "New password must be at least 8 characters long."
            }
        )
    
    # Update password
    if not update_password(request.current_password, request.new_password):
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Invalid password",
                "message": "Current password is incorrect."
            }
        )
    
    return {
        "success": True,
        "message": "Password changed successfully. Please log in again."
    }


@router.get("/setup/check")
def check_setup():
    """Check if first-run setup is required.
    
    Returns setup status and what needs to be configured.
    """
    from app.core.setup import is_setup_required
    
    setup_info = is_setup_required()
    
    return {
        "success": True,
        "setup_required": setup_info["required"],
        "needs_username": setup_info["needs_username"],
        "needs_password": setup_info["needs_password"],
        "default_username": setup_info.get("env_username", "admin")
    }


@router.post("/setup/complete")
def complete_setup(request: SetupRequest):
    """Complete first-run setup by creating admin credentials.
    
    This endpoint is only available when setup is required.
    """
    from app.core.setup import is_setup_required, complete_setup
    
    # Check if setup is actually required
    setup_info = is_setup_required()
    
    if not setup_info["required"]:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Setup not required",
                "message": "Admin account already exists."
            }
        )
    
    # Validate passwords match
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Password mismatch",
                "message": "Passwords do not match."
            }
        )
    
    # Validate password length
    if len(request.password) < 8:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Invalid password",
                "message": "Password must be at least 8 characters long."
            }
        )
    
    # Validate username if needed
    if setup_info["needs_username"]:
        if not request.username or len(request.username) < 3:
            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "error": "Invalid username",
                    "message": "Username must be at least 3 characters long."
                }
            )
    
    # Complete setup
    try:
        complete_setup(
            username=request.username,
            password=request.password
        )
        
        return {
            "success": True,
            "message": "Setup completed successfully. You can now log in."
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Setup failed",
                "message": str(e)
            }
        )
