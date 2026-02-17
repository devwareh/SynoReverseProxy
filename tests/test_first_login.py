"""Tests for /auth/first-login endpoint error classification.

These tests verify that Synology API error codes are correctly mapped
to appropriate HTTP responses and error messages, especially distinguishing
between credential errors and 2FA/OTP errors.
"""
import pytest
from unittest.mock import patch
from fastapi import HTTPException
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from app.api.routes.auth import first_login, FirstLoginRequest


class TestSynologyErrorCode400:
    """Test handling of Synology error code 400 (bad credentials)."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_400_without_otp_returns_invalid_credentials(self, mock_load_session, mock_get_session):
        """Test that Synology error 400 without OTP returns 401 invalid credentials.
        
        Error code 400 from Synology means "No such account or incorrect password".
        This should NOT be classified as a 2FA error.
        """
        # No existing session
        mock_load_session.return_value = None
        
        # Simulate Synology error 400
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 400}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        # Should be 401 (invalid credentials), not 400 (2FA required)
        assert exc_info.value.status_code == 401, (
            "Error code 400 from Synology should return HTTP 401 (invalid credentials)"
        )
        
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False, (
            "Error code 400 should NOT indicate OTP is required"
        )
        assert 'invalid' in detail['message'].lower() or 'incorrect' in detail['message'].lower(), (
            "Error message should mention invalid/incorrect credentials"
        )
        assert '2fa' not in detail['message'].lower(), (
            "Error message should NOT mention 2FA for error code 400"
        )
        assert 'otp' not in detail['message'].lower(), (
            "Error message should NOT mention OTP for error code 400"
        )

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_400_with_otp_returns_invalid_credentials(self, mock_load_session, mock_get_session):
        """Test that Synology error 400 with OTP provided still returns invalid credentials.
        
        Even if user provides OTP, error 400 means bad credentials, not OTP issue.
        """
        mock_load_session.return_value = None
        
        # Simulate Synology error 400
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 400}}"
        )
        
        request = FirstLoginRequest(otp_code="123456")
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False


class TestSynologyErrorCode401:
    """Test handling of Synology error code 401 (account disabled)."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_401_returns_account_disabled(self, mock_load_session, mock_get_session):
        """Test that Synology error 401 returns account disabled message.
        
        Error code 401 from Synology means "Account disabled".
        """
        mock_load_session.return_value = None
        
        # Simulate Synology error 401
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 401}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'disabled' in detail['message'].lower() or 'invalid' in detail['message'].lower()


class TestSynologyErrorCode403:
    """Test handling of Synology error code 403 (2FA required)."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_403_without_otp_requires_2fa(self, mock_load_session, mock_get_session):
        """Test that Synology error 403 without OTP indicates 2FA is required.
        
        Error code 403 from Synology means "2-factor authentication code required".
        """
        mock_load_session.return_value = None
        
        # Simulate Synology error 403
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 403}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        # Should be 400 (bad request - need OTP)
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True, (
            "Error code 403 should indicate OTP is required"
        )
        assert '2fa' in detail['message'].lower() or 'otp' in detail['message'].lower(), (
            "Error message should mention 2FA or OTP"
        )

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_403_with_wrong_otp_indicates_invalid_otp(self, mock_load_session, mock_get_session):
        """Test that Synology error 403 with OTP provided indicates invalid OTP.
        
        If user provides OTP but still gets 403, the OTP is likely wrong.
        """
        mock_load_session.return_value = None
        
        # Simulate Synology error 403 (wrong OTP)
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 403}}"
        )
        
        request = FirstLoginRequest(otp_code="wrong_otp")
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True


class TestSynologyErrorCode404:
    """Test handling of Synology error code 404 (invalid OTP)."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_404_with_otp_returns_invalid_otp(self, mock_load_session, mock_get_session):
        """Test that Synology error 404 with OTP returns invalid OTP message.
        
        Error code 404 from Synology means "Failed to authenticate 2-factor authentication code".
        """
        mock_load_session.return_value = None
        
        # Simulate Synology error 404
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 404}}"
        )
        
        request = FirstLoginRequest(otp_code="123456")
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True
        assert 'invalid' in detail['message'].lower() or 'incorrect' in detail['message'].lower()
        assert 'otp' in detail['message'].lower() or 'code' in detail['message'].lower()


class TestSuccessfulLogin:
    """Test successful login scenarios."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_successful_login_without_otp_non_2fa_user(self, mock_load_session, mock_get_session):
        """Test successful login without OTP for non-2FA user."""
        mock_load_session.return_value = None
        
        # Simulate successful login
        mock_get_session.return_value = {
            'sid': 'test_sid',
            'did': 'test_device_id',
            'synotoken': 'test_token',
            'expiry_time': 9999999999
        }
        
        request = FirstLoginRequest(otp_code=None)
        
        response = first_login(request)
        
        assert response['success'] is True
        assert response['requires_otp'] is False
        assert response['device_token_saved'] is True

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_successful_login_with_otp_2fa_user(self, mock_load_session, mock_get_session):
        """Test successful login with OTP for 2FA user."""
        mock_load_session.return_value = None
        
        # Simulate successful login with OTP
        mock_get_session.return_value = {
            'sid': 'test_sid',
            'did': 'test_device_id',
            'synotoken': 'test_token',
            'expiry_time': 9999999999
        }
        
        request = FirstLoginRequest(otp_code="123456")
        
        response = first_login(request)
        
        assert response['success'] is True
        assert response['requires_otp'] is False
        assert response['device_token_saved'] is True


class TestDeviceTokenFastPath:
    """Test device token fast path."""

    @patch('app.api.routes.auth.is_session_valid')
    @patch('app.api.routes.auth.load_session')
    def test_existing_valid_session_returns_immediately(self, mock_load_session, mock_is_valid):
        """Test that existing valid device token returns success without calling Synology API.
        
        If a valid device token and session already exist, /first-login should
        return success immediately without making another API call.
        """
        # Simulate existing valid session with device token
        mock_load_session.return_value = {
            'sid': 'existing_sid',
            'did': 'existing_device_id',
            'synotoken': 'existing_token',
            'expiry_time': 9999999999
        }
        mock_is_valid.return_value = True
        
        request = FirstLoginRequest(otp_code=None)
        
        response = first_login(request)
        
        assert response['success'] is True
        assert response['device_token_saved'] is True
        assert response['requires_otp'] is False
        assert 'already exists' in response['message'].lower()


class TestSynologyErrorCode402:
    """Test handling of Synology error code 402 (permission denied)."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_402_returns_permission_denied(self, mock_load_session, mock_get_session):
        """Test that Synology error 402 returns permission denied message."""
        mock_load_session.return_value = None
        
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 402}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 403
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'permission' in detail['message'].lower()


class TestSynologyErrorCode406:
    """Test handling of Synology error code 406 (enforce 2FA)."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_406_requires_2fa(self, mock_load_session, mock_get_session):
        """Test that Synology error 406 indicates 2FA is enforced."""
        mock_load_session.return_value = None
        
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 406}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True
        assert '2fa' in detail['message'].lower() or 'otp' in detail['message'].lower()


class TestSynologyErrorCode407:
    """Test handling of Synology error code 407 (blocked IP)."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_407_returns_ip_blocked(self, mock_load_session, mock_get_session):
        """Test that Synology error 407 returns IP blocked message."""
        mock_load_session.return_value = None
        
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 407}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 403
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'ip' in detail['message'].lower() or 'blocked' in detail['message'].lower()


class TestSynologyPasswordExpiry:
    """Test handling of password expiry error codes."""

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_408_expired_password_cannot_change(self, mock_load_session, mock_get_session):
        """Test that Synology error 408 returns expired password message."""
        mock_load_session.return_value = None
        
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 408}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'expired' in detail['message'].lower()

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_409_expired_password(self, mock_load_session, mock_get_session):
        """Test that Synology error 409 returns expired password message."""
        mock_load_session.return_value = None
        
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 409}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'expired' in detail['message'].lower()

    @patch('app.api.routes.auth.get_new_session_with_otp')
    @patch('app.api.routes.auth.load_session')
    def test_error_410_password_must_change(self, mock_load_session, mock_get_session):
        """Test that Synology error 410 returns password change required message."""
        mock_load_session.return_value = None
        
        mock_get_session.side_effect = Exception(
            "Login failed: {'success': False, 'error': {'code': 410}}"
        )
        
        request = FirstLoginRequest(otp_code=None)
        
        with pytest.raises(HTTPException) as exc_info:
            first_login(request)
        
        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'change' in detail['message'].lower() or 'must' in detail['message'].lower()


class TestErrorClassificationLogic:
    """Test the error classification logic directly."""

    def test_error_code_400_not_in_2fa_error_check(self):
        """Test that error code 400 is not classified as a 2FA error in the code.
        
        This is a static code analysis test to ensure the is_2fa_error logic
        does not include error code 400.
        """
        with open('backend/app/api/routes/auth.py', 'r') as f:
            content = f.read()
        
        # Find the is_2fa_error assignment
        import re
        is_2fa_pattern = r'is_2fa_error\s*=\s*\([^)]+\)'
        matches = re.findall(is_2fa_pattern, content, re.DOTALL)
        
        if matches:
            is_2fa_logic = matches[0]
            
            # Check that 400 is not in the error code list for 2FA
            # Pattern: error_code in [403, 400] should become error_code in [403, 404, 406]
            error_code_list_pattern = r'error_code\s+in\s+\[([^\]]+)\]'
            code_list_matches = re.findall(error_code_list_pattern, is_2fa_logic)
            
            if code_list_matches:
                code_list = code_list_matches[0]
                assert '400' not in code_list, (
                    "Error code 400 should NOT be in is_2fa_error check. "
                    "Code 400 means bad credentials, not 2FA required. "
                    f"Found: {is_2fa_logic}"
                )
                assert '403' in code_list, (
                    "Error code 403 (2FA required) should be in is_2fa_error check"
                )
                assert '404' in code_list, (
                    "Error code 404 (invalid OTP) should be in is_2fa_error check"
                )
                assert '406' in code_list, (
                    "Error code 406 (enforce 2FA) should be in is_2fa_error check"
                )
