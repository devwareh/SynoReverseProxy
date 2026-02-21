"""Tests for /auth/first-login endpoint error classification.

These tests verify that Synology API error codes are correctly mapped
to appropriate HTTP responses and error messages, especially distinguishing
between credential errors and 2FA/OTP errors.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from app.api.routes.auth import first_login, FirstLoginRequest
from app.core.auth import SynologyAuthError


def _fake_request():
    """Minimal Request-like object for first_login (rate limit keyed by client IP)."""
    m = MagicMock()
    m.client = MagicMock()
    m.client.host = "127.0.0.1"
    return m


def _syno_err(code):
    """Helper: build a SynologyAuthError for a given Synology error code."""
    return SynologyAuthError(error_code=code, raw_response={'success': False, 'error': {'code': code}})


@pytest.fixture(autouse=True)
def _rate_limit_passed(monkeypatch):
    """Disable rate limiting in first_login so tests do not get 429."""
    monkeypatch.setattr('app.api.routes.auth.check_rate_limit', lambda _: True)


class TestSynologyErrorCode400:
    """Test handling of Synology error code 400 (bad credentials)."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_400_without_otp_returns_invalid_credentials(self, mock_load_session, mock_get_session):
        """Synology error 400 = wrong password — must NOT be classified as 2FA."""
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(400)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 401, (
            "Error code 400 from Synology should return HTTP 401 (invalid credentials)"
        )
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'invalid' in detail['message'].lower() or 'incorrect' in detail['message'].lower()
        assert '2fa' not in detail['message'].lower()
        assert 'otp' not in detail['message'].lower()

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_400_with_otp_returns_invalid_credentials(self, mock_load_session, mock_get_session):
        """Error 400 with OTP provided still means bad credentials, not OTP issue."""
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(400)

        request = FirstLoginRequest(otp_code="123456")

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False


class TestSynologyErrorCode401:
    """Test handling of Synology error code 401 (account disabled)."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_401_returns_account_disabled(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(401)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'disabled' in detail['message'].lower() or 'invalid' in detail['message'].lower()


class TestSynologyErrorCode403:
    """Test handling of Synology error code 403 (2FA required)."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_403_without_otp_requires_2fa(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(403)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True
        assert '2fa' in detail['message'].lower() or 'otp' in detail['message'].lower()

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_403_with_wrong_otp_indicates_invalid_otp(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(403)

        request = FirstLoginRequest(otp_code="wrong_otp")

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True


class TestSynologyErrorCode404:
    """Test handling of Synology error code 404 (invalid OTP)."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_404_with_otp_returns_invalid_otp(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(404)

        request = FirstLoginRequest(otp_code="123456")

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True
        assert 'invalid' in detail['message'].lower() or 'incorrect' in detail['message'].lower()
        assert 'otp' in detail['message'].lower() or 'code' in detail['message'].lower()


class TestSuccessfulLogin:
    """Test successful login scenarios."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_successful_login_without_otp_non_2fa_user(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.return_value = {
            'sid': 'test_sid',
            'did': 'test_device_id',
            'synotoken': 'test_token',
            'expiry_time': 9999999999
        }

        request = FirstLoginRequest(otp_code=None)
        response = first_login(request, _fake_request())

        assert response['success'] is True
        assert response['requires_otp'] is False
        assert response['device_token_saved'] is True

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_successful_login_with_otp_2fa_user(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.return_value = {
            'sid': 'test_sid',
            'did': 'test_device_id',
            'synotoken': 'test_token',
            'expiry_time': 9999999999
        }

        request = FirstLoginRequest(otp_code="123456")
        response = first_login(request, _fake_request())

        assert response['success'] is True
        assert response['requires_otp'] is False
        assert response['device_token_saved'] is True


class TestDeviceTokenFastPath:
    """Test device token fast path."""

    @patch('app.api.routes.auth.is_session_valid')
    @patch('app.api.routes.auth.load_session')
    def test_existing_valid_session_returns_immediately(self, mock_load_session, mock_is_valid):
        """Existing valid device token should return success without hitting Synology."""
        mock_load_session.return_value = {
            'sid': 'existing_sid',
            'did': 'existing_device_id',
            'synotoken': 'existing_token',
            'expiry_time': 9999999999
        }
        mock_is_valid.return_value = True

        request = FirstLoginRequest(otp_code=None)
        response = first_login(request, _fake_request())

        assert response['success'] is True
        assert response['device_token_saved'] is True
        assert response['requires_otp'] is False
        assert 'already exists' in response['message'].lower()


class TestSynologyErrorCode402:
    """Test handling of Synology error code 402 (permission denied)."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_402_returns_permission_denied(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(402)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 403
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'permission' in detail['message'].lower()


class TestSynologyErrorCode406:
    """Test handling of Synology error code 406 (enforce 2FA)."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_406_requires_2fa(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(406)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert detail['requires_otp'] is True
        assert '2fa' in detail['message'].lower() or 'otp' in detail['message'].lower()


class TestSynologyErrorCode407:
    """Test handling of Synology error code 407 (blocked IP)."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_407_returns_ip_blocked(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(407)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 403
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'ip' in detail['message'].lower() or 'blocked' in detail['message'].lower()


class TestSynologyPasswordExpiry:
    """Test handling of password expiry error codes."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_408_expired_password_cannot_change(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(408)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'expired' in detail['message'].lower()

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_409_expired_password(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(409)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'expired' in detail['message'].lower()

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_410_password_must_change(self, mock_load_session, mock_get_session):
        mock_load_session.return_value = None
        mock_get_session.side_effect = _syno_err(410)

        request = FirstLoginRequest(otp_code=None)

        with pytest.raises(HTTPException) as exc_info:
            first_login(request, _fake_request())

        assert exc_info.value.status_code == 401
        detail = exc_info.value.detail
        assert detail['requires_otp'] is False
        assert 'change' in detail['message'].lower() or 'must' in detail['message'].lower()


class TestErrorClassificationLogic:
    """Dispatch-table correctness: verify error codes route to the right HTTP responses."""

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_error_code_400_not_classified_as_2fa(self, mock_load, mock_get):
        """Error code 400 must produce requires_otp=False (wrong credentials, not 2FA)."""
        mock_load.return_value = None
        mock_get.side_effect = _syno_err(400)
        with pytest.raises(HTTPException) as exc_info:
            first_login(FirstLoginRequest(otp_code=None), _fake_request())
        assert exc_info.value.detail['requires_otp'] is False

    @pytest.mark.parametrize("code", [403, 404, 406])
    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_2fa_codes_produce_requires_otp_true(self, mock_load, mock_get, code):
        """Error codes 403, 404, 406 must produce requires_otp=True."""
        mock_load.return_value = None
        mock_get.side_effect = _syno_err(code)
        with pytest.raises(HTTPException) as exc_info:
            first_login(FirstLoginRequest(otp_code=None), _fake_request())
        assert exc_info.value.detail['requires_otp'] is True

    @pytest.mark.parametrize("code", [400, 401, 402, 407, 408, 409, 410])
    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_credential_and_account_codes_produce_requires_otp_false(self, mock_load, mock_get, code):
        """Error codes 400, 401, 402, 407–410 must produce requires_otp=False."""
        mock_load.return_value = None
        mock_get.side_effect = _syno_err(code)
        with pytest.raises(HTTPException) as exc_info:
            first_login(FirstLoginRequest(otp_code=None), _fake_request())
        assert exc_info.value.detail['requires_otp'] is False

    @patch('app.api.routes.auth.get_new_session')
    @patch('app.api.routes.auth.load_session')
    def test_unknown_error_code_none_no_otp_returns_400(self, mock_load, mock_get):
        """Unknown error (code=None) with no OTP must return 400 with 'unknown' in message."""
        mock_load.return_value = None
        mock_get.side_effect = SynologyAuthError(
            error_code=None, raw_response={'success': False}
        )
        with pytest.raises(HTTPException) as exc_info:
            first_login(FirstLoginRequest(otp_code=None), _fake_request())
        assert exc_info.value.status_code == 400
        assert 'unknown' in exc_info.value.detail['message'].lower()
        assert exc_info.value.detail['requires_otp'] is None


class TestFirstLoginRateLimit:
    """Rate limiting on /auth/first-login to prevent OTP brute-force."""

    @patch('app.api.routes.auth.check_rate_limit', return_value=False)
    @patch('app.api.routes.auth.load_session')
    def test_first_login_returns_429_when_rate_limited(self, mock_load, mock_rate_limit):
        """When rate limit is exceeded, first_login returns 429 without calling NAS."""
        mock_load.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            first_login(FirstLoginRequest(otp_code="123456"), _fake_request())
        assert exc_info.value.status_code == 429
        assert "too many" in exc_info.value.detail["message"].lower()
        mock_rate_limit.assert_called_once()
