"""Tests for ACL (Access Control List) support — Issue #16.

Covers:
- Schema: acl field accepts UUID string or None, rejects dict
- build_rule(): passes ACL UUID into frontend.acl
- SynoReverseProxyManager: list/create/update/delete ACL profiles
- GET /acl, POST /acl, PUT /acl/{uuid}, DELETE /acl/{uuid} routes
"""
import json
import pytest
from pydantic import ValidationError
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from app.models.schemas import ReverseProxyRule, AclProfile, AclRule


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

ACL_UUID = "599e36d8-f3cc-4e81-8f95-4e175ced9bdc"
ACL_KEY  = "42108aea-c484-444d-ac32-8a2aa6578036"

SAMPLE_PROFILE = {
    "UUID": ACL_UUID,
    "_key": ACL_KEY,
    "name": "test profile",
    "rules": [
        {"access": True,  "address": "192.168.0.210"},
        {"access": False, "address": ""},
    ],
}

SAMPLE_NAS_LIST = {
    "success": True,
    "data": {"entries": [SAMPLE_PROFILE]},
}


def _make_mgr(sid="test-sid", synotoken="test-token", nas_url="http://nas:5000"):
    from app.core.synology import SynoReverseProxyManager
    return SynoReverseProxyManager(nas_url, sid, synotoken=synotoken)


def _fake_user():
    return "testuser"


# ---------------------------------------------------------------------------
# Phase 1 — Schema
# ---------------------------------------------------------------------------

class TestReverseProxyRuleAclSchema:
    """ReverseProxyRule.acl must accept UUID strings and None, not dicts."""

    def test_acl_accepts_uuid_string(self):
        rule = ReverseProxyRule(
            description="test",
            backend_fqdn="localhost",
            backend_port=8080,
            frontend_fqdn="example.com",
            acl=ACL_UUID,
        )
        assert rule.acl == ACL_UUID

    def test_acl_accepts_none(self):
        rule = ReverseProxyRule(
            description="test",
            backend_fqdn="localhost",
            backend_port=8080,
            frontend_fqdn="example.com",
            acl=None,
        )
        assert rule.acl is None

    def test_acl_defaults_to_none(self):
        rule = ReverseProxyRule(
            description="test",
            backend_fqdn="localhost",
            backend_port=8080,
            frontend_fqdn="example.com",
        )
        assert rule.acl is None

    def test_acl_rejects_dict(self):
        with pytest.raises(ValidationError):
            ReverseProxyRule(
                description="test",
                backend_fqdn="localhost",
                backend_port=8080,
                frontend_fqdn="example.com",
                acl={"some": "dict"},  # must be rejected
            )


class TestAclProfileSchema:
    """AclProfile and AclRule Pydantic models."""

    def test_acl_rule_allow(self):
        r = AclRule(access=True, address="192.168.1.0/24")
        assert r.access is True
        assert r.address == "192.168.1.0/24"

    def test_acl_rule_deny_catchall(self):
        r = AclRule(access=False, address="")
        assert r.access is False
        assert r.address == ""

    def test_acl_profile_valid(self):
        p = AclProfile(
            name="My Profile",
            rules=[
                AclRule(access=True, address="10.0.0.0/8"),
                AclRule(access=False, address=""),
            ],
        )
        assert p.name == "My Profile"
        assert len(p.rules) == 2

    def test_acl_profile_empty_rules(self):
        p = AclProfile(name="Empty", rules=[])
        assert p.rules == []


class TestAclRuleAddressValidation:
    """AclRule.address validator: accepts valid IPs/CIDR/empty, rejects garbage."""

    def test_accepts_ipv4(self):
        r = AclRule(access=True, address="192.168.1.1")
        assert r.address == "192.168.1.1"

    def test_accepts_ipv4_cidr(self):
        r = AclRule(access=True, address="10.0.0.0/8")
        assert r.address == "10.0.0.0/8"

    def test_accepts_ipv6(self):
        r = AclRule(access=False, address="::1")
        assert r.address == "::1"

    def test_accepts_ipv6_cidr(self):
        r = AclRule(access=True, address="2001:db8::/32")
        assert r.address == "2001:db8::/32"

    def test_accepts_empty_catchall(self):
        r = AclRule(access=False, address="")
        assert r.address == ""

    def test_rejects_hostname(self):
        with pytest.raises(ValidationError):
            AclRule(access=True, address="example.com")

    def test_rejects_invalid_string(self):
        with pytest.raises(ValidationError):
            AclRule(access=True, address="not-an-ip")

    def test_rejects_partial_ip(self):
        with pytest.raises(ValidationError):
            AclRule(access=True, address="192.168")


class TestAclProfileNameValidation:
    """AclProfile.name validator: min length, max length, whitespace-only."""

    def test_valid_name(self):
        p = AclProfile(name="Home Network")
        assert p.name == "Home Network"

    def test_strips_leading_trailing_whitespace(self):
        p = AclProfile(name="  My Profile  ")
        assert p.name == "My Profile"

    def test_rejects_empty_name(self):
        with pytest.raises(ValidationError):
            AclProfile(name="")

    def test_rejects_whitespace_only_name(self):
        with pytest.raises(ValidationError):
            AclProfile(name="   ")

    def test_rejects_name_exceeding_max_length(self):
        with pytest.raises(ValidationError):
            AclProfile(name="a" * 65)

    def test_accepts_name_at_max_length(self):
        p = AclProfile(name="a" * 64)
        assert len(p.name) == 64


# ---------------------------------------------------------------------------
# Phase 2 — build_rule() with ACL
# ---------------------------------------------------------------------------

class TestBuildRuleAcl:
    """build_rule() must place acl UUID inside frontend.acl."""

    def test_build_rule_with_acl_uuid(self):
        mgr = _make_mgr()
        rule = mgr.build_rule(
            description="FILE",
            backend_fqdn="localhost",
            backend_port=7000,
            frontend_fqdn="files.example.com",
            acl=ACL_UUID,
        )
        assert rule["frontend"]["acl"] == ACL_UUID

    def test_build_rule_without_acl(self):
        mgr = _make_mgr()
        rule = mgr.build_rule(
            description="PLAIN",
            backend_fqdn="localhost",
            backend_port=80,
            frontend_fqdn="plain.example.com",
        )
        assert "acl" not in rule["frontend"]

    def test_build_rule_acl_none_explicit(self):
        mgr = _make_mgr()
        rule = mgr.build_rule(
            description="PLAIN",
            backend_fqdn="localhost",
            backend_port=80,
            frontend_fqdn="plain.example.com",
            acl=None,
        )
        assert "acl" not in rule["frontend"]


# ---------------------------------------------------------------------------
# Phase 2 — SynoReverseProxyManager ACL methods
# ---------------------------------------------------------------------------

class TestSynoManagerListAclProfiles:
    """list_acl_profiles() calls SYNO.Core.AppPortal.AccessControl list."""

    @patch('app.core.synology.requests.Session.get')
    def test_list_returns_profiles(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: SAMPLE_NAS_LIST)
        mgr = _make_mgr()
        result = mgr.list_acl_profiles()
        assert result["success"] is True
        entries = result["data"]["entries"]
        assert len(entries) == 1
        assert entries[0]["name"] == "test profile"

    @patch('app.core.synology.requests.Session.get')
    def test_list_passes_correct_api_params(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: SAMPLE_NAS_LIST)
        mgr = _make_mgr()
        mgr.list_acl_profiles()
        call_params = mock_get.call_args[1]["params"]
        assert call_params["api"] == "SYNO.Core.AppPortal.AccessControl"
        assert call_params["method"] == "list"


class TestSynoManagerCreateAclProfile:
    """create_acl_profile() POSTs entry=<json> to AccessControl create."""

    @patch('app.core.synology.requests.Session.post')
    def test_create_success(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"success": True})
        mgr = _make_mgr()
        rules = [{"access": True, "address": "192.168.1.0/24"}, {"access": False, "address": ""}]
        result = mgr.create_acl_profile("My Profile", rules)
        assert result["success"] is True

    @patch('app.core.synology.requests.Session.post')
    def test_create_sends_entry_json(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"success": True})
        mgr = _make_mgr()
        rules = [{"access": True, "address": "10.0.0.1"}]
        mgr.create_acl_profile("TestProfile", rules)
        call_data = mock_post.call_args[1]["data"]
        entry = json.loads(call_data["entry"])
        assert entry["name"] == "TestProfile"
        assert entry["rules"] == rules


class TestSynoManagerUpdateAclProfile:
    """update_acl_profile() fetches _key from list then POSTs update."""

    @patch('app.core.synology.requests.Session.post')
    @patch('app.core.synology.requests.Session.get')
    def test_update_success(self, mock_get, mock_post):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: SAMPLE_NAS_LIST)
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"success": True})
        mgr = _make_mgr()
        rules = [{"access": True, "address": "192.168.0.0/24"}, {"access": False, "address": ""}]
        result = mgr.update_acl_profile(ACL_UUID, "renamed", rules)
        assert result["success"] is True

    @patch('app.core.synology.requests.Session.post')
    @patch('app.core.synology.requests.Session.get')
    def test_update_includes_uuid_and_key(self, mock_get, mock_post):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: SAMPLE_NAS_LIST)
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"success": True})
        mgr = _make_mgr()
        mgr.update_acl_profile(ACL_UUID, "renamed", [])
        call_data = mock_post.call_args[1]["data"]
        entry = json.loads(call_data["entry"])
        assert entry["UUID"] == ACL_UUID
        assert entry["_key"] == ACL_KEY

    @patch('app.core.synology.requests.Session.get')
    def test_update_returns_404_for_unknown_uuid(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: SAMPLE_NAS_LIST)
        mgr = _make_mgr()
        result = mgr.update_acl_profile("non-existent-uuid", "name", [])
        assert result["success"] is False
        assert result["error"]["code"] == 404


class TestSynoManagerDeleteAclProfiles:
    """delete_acl_profiles() POSTs uuids=<json_array>."""

    @patch('app.core.synology.requests.Session.post')
    def test_delete_success(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"success": True})
        mgr = _make_mgr()
        result = mgr.delete_acl_profiles([ACL_UUID])
        assert result["success"] is True

    @patch('app.core.synology.requests.Session.post')
    def test_delete_sends_uuids_json_array(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"success": True})
        mgr = _make_mgr()
        mgr.delete_acl_profiles([ACL_UUID, "other-uuid"])
        call_data = mock_post.call_args[1]["data"]
        uuids = json.loads(call_data["uuids"])
        assert ACL_UUID in uuids
        assert "other-uuid" in uuids


# ---------------------------------------------------------------------------
# Phase 3 — ACL Routes
# ---------------------------------------------------------------------------

def _mock_mgr(list_response=None, create_response=None, update_response=None, delete_response=None):
    mgr = MagicMock()
    mgr.list_acl_profiles.return_value = list_response or SAMPLE_NAS_LIST
    mgr.create_acl_profile.return_value = create_response or {"success": True}
    mgr.update_acl_profile.return_value = update_response or {"success": True}
    mgr.delete_acl_profiles.return_value = delete_response or {"success": True}
    return mgr


class TestAclListRoute:
    """GET /acl — list all ACL profiles."""

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_list_returns_200_with_entries(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import list_acl_profiles
        mock_user.return_value = _fake_user()
        mock_mgr_dep.return_value = _mock_mgr()
        result = list_acl_profiles(mgr=_mock_mgr(), _=_fake_user())
        entries = result["data"]["entries"]
        assert len(entries) == 1
        assert entries[0]["name"] == "test profile"

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_list_raises_500_on_exception(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import list_acl_profiles
        mgr = MagicMock()
        mgr.list_acl_profiles.side_effect = Exception("NAS unreachable")
        with pytest.raises(HTTPException) as exc:
            list_acl_profiles(mgr=mgr, _=_fake_user())
        assert exc.value.status_code == 500


class TestAclCreateRoute:
    """POST /acl — create a new ACL profile."""

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_create_returns_success(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import create_acl_profile
        profile = AclProfile(name="New", rules=[AclRule(access=True, address="10.0.0.1")])
        result = create_acl_profile(profile=profile, mgr=_mock_mgr(), _=_fake_user())
        assert result["success"] is True

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_create_raises_400_on_nas_failure(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import create_acl_profile
        mgr = _mock_mgr(create_response={"success": False, "error": {"code": 400}})
        profile = AclProfile(name="Bad", rules=[])
        with pytest.raises(HTTPException) as exc:
            create_acl_profile(profile=profile, mgr=mgr, _=_fake_user())
        assert exc.value.status_code == 400


class TestAclUpdateRoute:
    """PUT /acl/{uuid} — update an existing ACL profile."""

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_update_returns_success(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import update_acl_profile
        profile = AclProfile(name="Updated", rules=[])
        result = update_acl_profile(uuid=ACL_UUID, profile=profile, mgr=_mock_mgr(), _=_fake_user())
        assert result["success"] is True

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_update_raises_404_when_not_found(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import update_acl_profile
        mgr = _mock_mgr(update_response={"success": False, "error": {"code": 404}})
        profile = AclProfile(name="X", rules=[])
        with pytest.raises(HTTPException) as exc:
            update_acl_profile(uuid="00000000-0000-0000-0000-000000000000", profile=profile, mgr=mgr, _=_fake_user())
        assert exc.value.status_code == 404


class TestAclRouteUuidValidation:
    """PUT and DELETE /acl/{uuid} — reject invalid UUID path params with 422."""

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_update_rejects_invalid_uuid(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import update_acl_profile
        profile = AclProfile(name="X", rules=[])
        with pytest.raises(HTTPException) as exc:
            update_acl_profile(uuid="not-a-uuid", profile=profile, mgr=_mock_mgr(), _=_fake_user())
        assert exc.value.status_code == 422

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_delete_rejects_invalid_uuid(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import delete_acl_profile
        with pytest.raises(HTTPException) as exc:
            delete_acl_profile(uuid="not-a-uuid", mgr=_mock_mgr(), _=_fake_user())
        assert exc.value.status_code == 422

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_update_rejects_empty_uuid(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import update_acl_profile
        profile = AclProfile(name="X", rules=[])
        with pytest.raises(HTTPException) as exc:
            update_acl_profile(uuid="", profile=profile, mgr=_mock_mgr(), _=_fake_user())
        assert exc.value.status_code == 422

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_delete_rejects_partial_uuid(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import delete_acl_profile
        with pytest.raises(HTTPException) as exc:
            delete_acl_profile(uuid="599e36d8-f3cc", mgr=_mock_mgr(), _=_fake_user())
        assert exc.value.status_code == 422


class TestAclDeleteRoute:
    """DELETE /acl/{uuid} — delete an ACL profile."""

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_delete_returns_success(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import delete_acl_profile
        result = delete_acl_profile(uuid=ACL_UUID, mgr=_mock_mgr(), _=_fake_user())
        assert result["success"] is True

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_delete_raises_400_on_nas_failure(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import delete_acl_profile
        mgr = _mock_mgr(delete_response={"success": False, "error": {"code": 400}})
        with pytest.raises(HTTPException) as exc:
            delete_acl_profile(uuid=ACL_UUID, mgr=mgr, _=_fake_user())
        assert exc.value.status_code == 400

    @patch('app.api.routes.acl.get_mgr')
    @patch('app.api.routes.acl.get_current_user')
    def test_delete_raises_500_on_exception(self, mock_user, mock_mgr_dep):
        from app.api.routes.acl import delete_acl_profile
        mgr = MagicMock()
        mgr.delete_acl_profiles.side_effect = Exception("NAS error")
        with pytest.raises(HTTPException) as exc:
            delete_acl_profile(uuid=ACL_UUID, mgr=mgr, _=_fake_user())
        assert exc.value.status_code == 500
