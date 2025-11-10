"""API routes for authentication."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.auth import get_new_session, is_session_valid
from app.core.config import get_settings
from app.utils.encryption import load_session, save_session

router = APIRouter(prefix="/auth", tags=["authentication"])


class FirstLoginRequest(BaseModel):
    """Request model for first login endpoint."""
    otp_code: Optional[str] = None


@router.post("/first-login")
def first_login(request: FirstLoginRequest):
    """
    Perform first-time authentication with optional OTP.
    
    This endpoint handles both 2FA-enabled users (with OTP) and non-2FA users (without OTP).
    After successful login, the device token is saved for future logins.
    
    Args:
        request: FirstLoginRequest with optional otp_code
        
    Returns:
        Success message with device token status
    """
    try:
        settings = get_settings()
        
        # Check if device token already exists
        existing_session = load_session()
        if existing_session and existing_session.get('did'):
            # Check if session is still valid
            if is_session_valid(existing_session.get('sid'), existing_session.get('synotoken')):
                return {
                    "success": True,
                    "message": "Device token already exists and session is valid. No login needed.",
                    "device_token_saved": True,
                    "requires_otp": False
                }
        
        # Attempt first login with optional OTP
        try:
            # Try login with OTP if provided, or without OTP if not provided
            session_data = get_new_session_with_otp(otp_code=request.otp_code)
            
            # Success - device token should be saved
            device_token_saved = session_data.get('did') is not None
            
            return {
                "success": True,
                "message": "First login successful. Device token saved." if device_token_saved else "First login successful.",
                "device_token_saved": device_token_saved,
                "requires_otp": False
            }
            
        except Exception as login_error:
            error_str = str(login_error).lower()
            error_code = None
            error_message = None
            
            # Try to parse error from login response
            if "login failed" in error_str:
                # Try to extract error details from the exception message
                try:
                    import json
                    import re
                    import ast
                    
                    # Try to extract the error dict from the exception string
                    # Format: "Login failed: {'error': {'code': 401, ...}}"
                    error_match = re.search(r'\{.*\}', str(login_error), re.DOTALL)
                    if error_match:
                        try:
                            error_dict = ast.literal_eval(error_match.group(0))
                            if isinstance(error_dict, dict):
                                # Check for nested error structure
                                if 'error' in error_dict:
                                    error_info = error_dict['error']
                                    if isinstance(error_info, dict):
                                        error_code = error_info.get('code')
                                        error_message = error_info.get('message') or error_info.get('errors')
                                elif 'code' in error_dict:
                                    error_code = error_dict.get('code')
                                    error_message = error_dict.get('message')
                        except (ValueError, SyntaxError):
                            # Try regex extraction as fallback
                            code_match = re.search(r'"code":\s*(\d+)', str(login_error))
                            if code_match:
                                error_code = int(code_match.group(1))
                except Exception:
                    pass
            
            # Handle specific error codes
            if error_code == 401:
                raise HTTPException(
                    status_code=401,
                    detail={
                        "success": False,
                        "error": "Invalid credentials",
                        "message": "Username or password is incorrect. Please check your credentials.",
                        "requires_otp": False
                    }
                )
            
            # Check for 2FA-related errors in error message or code
            # Synology error codes for 2FA: typically 403 or specific 2FA error codes
            is_2fa_error = (
                error_code in [403, 400] or  # Common 2FA error codes
                any(keyword in error_str for keyword in [
                    "otp", "2fa", "two-factor", "two factor", 
                    "authentication code", "verification code",
                    "verification", "authenticator"
                ]) or
                (error_message and any(keyword in str(error_message).lower() for keyword in [
                    "otp", "2fa", "two-factor", "verification"
                ]))
            )
            
            if is_2fa_error:
                # 2FA is required but OTP was missing or incorrect
                if not request.otp_code:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "success": False,
                            "error": "2FA authentication required",
                            "message": "Please provide OTP code. Your account has 2FA enabled.",
                            "requires_otp": True
                        }
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "success": False,
                            "error": "Invalid OTP code",
                            "message": "The provided OTP code is incorrect or expired. Please generate a new OTP code and try again.",
                            "requires_otp": True
                        }
                    )
            
            # If OTP was provided but login failed, try without OTP (might be non-2FA account)
            if request.otp_code:
                try:
                    # Retry without OTP - might be a non-2FA account
                    session_data = get_new_session_with_otp(otp_code=None)
                    device_token_saved = session_data.get('did') is not None
                    
                    return {
                        "success": True,
                        "message": "First login successful (2FA not enabled). Device token saved." if device_token_saved else "First login successful (2FA not enabled).",
                        "device_token_saved": device_token_saved,
                        "requires_otp": False,
                        "note": "OTP was provided but not required. Your account does not have 2FA enabled."
                    }
                except Exception as retry_error:
                    # Both attempts failed - return generic error
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "success": False,
                            "error": "Authentication failed",
                            "message": f"Login failed with and without OTP. Please verify your credentials and OTP code if 2FA is enabled.",
                            "requires_otp": None  # Unknown
                        }
                    )
            else:
                # No OTP provided, but login failed - might need OTP or invalid credentials
                raise HTTPException(
                    status_code=400,
                    detail={
                        "success": False,
                        "error": "Authentication failed",
                        "message": f"Login failed: {str(login_error)}. If your account has 2FA enabled, please provide an OTP code. Otherwise, verify your username and password.",
                        "requires_otp": None  # Unknown, but suggest trying with OTP
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


def get_new_session_with_otp(otp_code: Optional[str] = None) -> dict:
    """
    Helper function to get new session with optional OTP.
    Handles both 2FA and non-2FA users.
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
        "enable_syno_token": "yes",
        "enable_device_token": "yes",  # Always try to enable device token
        "device_name": settings.synology_device_name
    }
    
    # Add OTP if provided
    if otp_code:
        params["otp_code"] = otp_code
    
    import requests
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
    
    import time
    expiry_time = time.time() + settings.synology_session_expiry_secs
    
    # Save session with device token
    save_session(sid, did, synotoken, expiry_time)
    
    return {
        'sid': sid,
        'did': did,
        'synotoken': synotoken,
        'expiry_time': expiry_time
    }

