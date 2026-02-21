"""Tests for get_mgr() dependency behavior."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from app.core.auth import SynologyAuthError


def _make_stale_session():
    return {'sid': 'old_sid', 'did': 'saved_device_id', 'synotoken': 't', 'expiry_time': 1}


@patch('app.api.dependencies.get_new_session')
@patch('app.api.dependencies.is_session_valid')
@patch('app.api.dependencies.load_session')
def test_get_mgr_raises_401_when_device_token_rejected(
    mock_load, mock_valid, mock_new_session
):
    """get_mgr must return 401 (not 500) when the NAS rejects a stored device token."""
    from app.api.dependencies import get_mgr
    mock_load.return_value = _make_stale_session()
    mock_valid.return_value = False  # sid invalid, must renew
    mock_new_session.side_effect = SynologyAuthError(
        error_code=400, raw_response={'success': False, 'error': {'code': 400}}
    )

    with pytest.raises(HTTPException) as exc_info:
        get_mgr()

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail.get('requires_first_login') is True


@patch('app.api.dependencies.get_new_session')
@patch('app.api.dependencies.is_session_valid')
@patch('app.api.dependencies.load_session')
def test_get_mgr_raises_401_when_synology_error_code_none(
    mock_load, mock_valid, mock_new_session
):
    """get_mgr must return 401 when NAS returns error with no code (error_code=None)."""
    from app.api.dependencies import get_mgr
    mock_load.return_value = _make_stale_session()
    mock_valid.return_value = False
    mock_new_session.side_effect = SynologyAuthError(
        error_code=None, raw_response={'success': False, 'error': {}}
    )

    with pytest.raises(HTTPException) as exc_info:
        get_mgr()

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail.get('requires_first_login') is True
