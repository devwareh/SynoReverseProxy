"""Tests for SSL certificate verification behavior in get_new_session."""
import os
import pytest
from unittest.mock import patch, MagicMock, call


def _mock_success_response():
    """Return a mock requests.Response for a successful Synology login."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = {
        "success": True,
        "data": {
            "sid": "test-sid-123",
            "did": "test-did-456",
            "synotoken": "test-token-789"
        }
    }
    return mock_resp


def _call_get_new_session(extra_env=None):
    """
    Call get_new_session with a fresh Settings instance and mocked requests.Session.
    Returns (mock_session_instance, call_kwargs) where call_kwargs is the keyword
    arguments from the requests.Session().get() call.
    """
    base_env = {
        'SYNOLOGY_NAS_URL': 'https://192.168.0.1:5001',
        'SYNOLOGY_USERNAME': 'admin',
        'SYNOLOGY_PASSWORD': 'pass',
    }
    if extra_env:
        base_env.update(extra_env)

    with patch.dict(os.environ, base_env, clear=True), \
         patch('requests.Session') as mock_session_cls, \
         patch('app.utils.encryption.save_session'):

        mock_session_instance = MagicMock()
        mock_session_cls.return_value = mock_session_instance
        mock_session_instance.get.return_value = _mock_success_response()

        # Import fresh after patching env so Settings picks up new values
        import importlib
        import app.core.config as config_mod
        import app.core.auth as auth_mod
        importlib.reload(config_mod)
        importlib.reload(auth_mod)

        auth_mod.get_new_session()

        _, kwargs = mock_session_instance.get.call_args
        return mock_session_instance, kwargs


class TestSSLVerifyPassedToRequests:
    """Verify the ssl_verify setting is correctly forwarded to requests.Session.get."""

    def test_ssl_verify_defaults_to_false_when_env_not_set(self):
        """Unset SYNOLOGY_SSL_VERIFY should default to False (backward compatible)."""
        _, kwargs = _call_get_new_session()
        assert kwargs.get('verify') is False, (
            "Default (unset SYNOLOGY_SSL_VERIFY) should pass verify=False to preserve "
            "backward compatibility with self-signed Synology certificates."
        )

    def test_ssl_verify_false_when_explicitly_set_false(self):
        """SYNOLOGY_SSL_VERIFY=false should pass verify=False to requests."""
        _, kwargs = _call_get_new_session({'SYNOLOGY_SSL_VERIFY': 'false'})
        assert kwargs.get('verify') is False

    def test_ssl_verify_true_when_explicitly_set_true(self):
        """SYNOLOGY_SSL_VERIFY=true should pass verify=True to requests."""
        _, kwargs = _call_get_new_session({'SYNOLOGY_SSL_VERIFY': 'true'})
        assert kwargs.get('verify') is True
