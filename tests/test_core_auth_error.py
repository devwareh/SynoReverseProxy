"""Tests for SynologyAuthError domain exception in core/auth.py."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))


def test_synology_auth_error_importable_from_core():
    from app.core.auth import SynologyAuthError
    err = SynologyAuthError(error_code=400, raw_response={'success': False})
    assert err.error_code == 400
    assert err.raw_response == {'success': False}
    assert "400" in str(err)


def test_get_new_session_raises_synology_auth_error_on_failure(monkeypatch):
    """get_new_session must raise SynologyAuthError (not bare Exception) on DSM failure."""
    import requests as _req
    from app.core.auth import get_new_session, SynologyAuthError
    import pytest

    class FakeResponse:
        def raise_for_status(self): pass
        def json(self): return {'success': False, 'error': {'code': 400}}

    class FakeSession:
        def get(self, *a, **kw): return FakeResponse()

    monkeypatch.setattr(_req, 'Session', lambda: FakeSession())

    with pytest.raises(SynologyAuthError) as exc_info:
        get_new_session(device_id=None, otp_code=None)
    assert exc_info.value.error_code == 400


def test_routes_auth_does_not_define_its_own_synology_auth_error():
    """SynologyAuthError must be defined in core/auth.py, not routes/auth.py."""
    import inspect
    import app.api.routes.auth as routes_mod
    src = inspect.getsource(routes_mod)
    assert "class SynologyAuthError" not in src, (
        "SynologyAuthError must be defined in core/auth.py, not routes/auth.py"
    )
