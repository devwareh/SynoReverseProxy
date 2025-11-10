"""Synology Reverse Proxy Manager - Core API interaction."""
import json
import requests
from typing import Optional, List, Dict, Any


class SynoReverseProxyManager:
    """Manager for interacting with Synology Reverse Proxy API."""
    
    def __init__(self, nas_url: str, sid: str, synotoken: Optional[str] = None, session=None):
        self.nas_url = nas_url.rstrip('/')
        self.sid = sid
        self.synotoken = synotoken
        self.session = session or requests.Session()
        self.api_url = f"{self.nas_url}/webapi/entry.cgi"
    
    def _get_params(self, **kwargs) -> Dict[str, Any]:
        """Build API parameters with SID and optional SynoToken."""
        params = {"_sid": self.sid, **kwargs}
        if self.synotoken:
            params["SynoToken"] = self.synotoken
        return params

    def list_rules(self) -> Dict[str, Any]:
        """List all reverse proxy rules."""
        payload = self._get_params(
            api="SYNO.Core.AppPortal.ReverseProxy",
            method="list",
            version="1"
        )
        resp = self.session.get(self.api_url, params=payload, verify=False)
        resp.raise_for_status()
        return resp.json()

    def get_rule(self, rule_id: str) -> Dict[str, Any]:
        """Get a single reverse proxy rule by UUID.
        
        Tries the get API method first (which includes _key), then falls back to list.
        """
        # Try the get API method first (this might include _key field)
        # Try both 'id' and 'uuid' parameters
        for param_name in ['id', 'uuid', 'UUID']:
            try:
                payload = self._get_params(
                    api="SYNO.Core.AppPortal.ReverseProxy",
                    method="get",
                    version="1",
                    **{param_name: rule_id}
                )
                resp = self.session.get(self.api_url, params=payload, verify=False)
                resp.raise_for_status()
                result = resp.json()
                if result.get("success"):
                    return result
            except Exception:
                # Try next parameter name
                continue
        
        # Fall back to list method - get all rules and find matching one
        all_rules = self.list_rules()
        entries = all_rules.get("data", {}).get("entries", [])
        
        # Find the rule with matching UUID (try both uppercase and lowercase)
        for entry in entries:
            if entry.get("UUID") == rule_id or entry.get("uuid") == rule_id or entry.get("id") == rule_id:
                return {
                    "success": True,
                    "data": {
                        "entry": entry
                    }
                }
        
        # Rule not found
        return {
            "success": False,
            "error": {
                "code": 404,
                "message": f"Rule with UUID {rule_id} not found"
            }
        }

    def create_rule(self, rule_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new reverse proxy rule."""
        params = self._get_params(
            api="SYNO.Core.AppPortal.ReverseProxy",
            method="create",
            version="1"
        )
        data = {"entry": json.dumps(rule_dict)}
        resp = self.session.post(self.api_url, params=params, data=data, verify=False)
        resp.raise_for_status()
        return resp.json()
    
    def update_rule(self, rule_id: str, rule_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing reverse proxy rule."""
        params = self._get_params(
            api="SYNO.Core.AppPortal.ReverseProxy",
            method="update",
            version="1"
        )
        
        # Get the existing rule to extract the _key field (required for update)
        existing_rule = self.get_rule(rule_id)
        if not existing_rule.get("success"):
            return {
                "success": False,
                "error": {"code": 404, "message": f"Rule with UUID {rule_id} not found"}
            }
        
        existing_entry = existing_rule.get("data", {}).get("entry", {})
        
        # Debug: log what fields are available
        print(f"DEBUG: Available fields in entry: {list(existing_entry.keys())}")
        
        # Try different possible field names for _key
        _key = existing_entry.get("_key") or existing_entry.get("key") or existing_entry.get("_uuid")
        
        # If _key is still not found, the list API might not include it
        # In that case, we might need to use UUID as _key, or fetch it differently
        if not _key:
            # Some Synology APIs use UUID as the key identifier
            # Try using the UUID itself as _key
            _key = existing_entry.get("UUID") or existing_entry.get("uuid") or rule_id
            print(f"DEBUG: Using UUID as _key fallback: {_key}")
        
        # Final check - if still no _key, return detailed error
        if not _key:
            return {
                "success": False,
                "error": {
                    "code": 400, 
                    "message": f"Could not find _key in existing rule. Available fields: {list(existing_entry.keys())}"
                }
            }
        
        # Include UUID and _key in the entry data - Synology API requires both
        rule_dict_with_uuid = rule_dict.copy()
        rule_dict_with_uuid["UUID"] = rule_id
        rule_dict_with_uuid["_key"] = _key
        
        data = {"entry": json.dumps(rule_dict_with_uuid)}
        resp = self.session.post(self.api_url, params=params, data=data, verify=False)
        resp.raise_for_status()
        return resp.json()
    
    def delete_rule(self, rule_id: str) -> Dict[str, Any]:
        """Delete a single reverse proxy rule by UUID."""
        return self.delete_rules([rule_id])
    
    def delete_rules(self, rule_ids: List[str]) -> Dict[str, Any]:
        """Delete multiple reverse proxy rules by UUIDs."""
        params = self._get_params(
            api="SYNO.Core.AppPortal.ReverseProxy",
            method="delete",
            version="1"
        )
        # Synology API expects uuids as a JSON array in POST data
        # The uuids parameter should be a JSON string of an array
        data = {"uuids": json.dumps(rule_ids)}
        
        resp = self.session.post(self.api_url, params=params, data=data, verify=False)
        resp.raise_for_status()
        result = resp.json()
        return result

    def build_rule(self, **kwargs):
        """Build a rule dictionary from keyword arguments."""
        # Ensure customize_headers is always a list, not None
        customize_headers = kwargs.get("customize_headers")
        if customize_headers is None:
            customize_headers = []
        
        rule = {
            "description": kwargs["description"],
            "backend": {
                "fqdn": kwargs["backend_fqdn"],
                "port": kwargs["backend_port"],
                "protocol": kwargs.get("backend_protocol", 0)
            },
            "frontend": {
                "fqdn": kwargs["frontend_fqdn"],
                "port": kwargs.get("frontend_port", 443),
                "protocol": kwargs.get("frontend_protocol", 1),
                "https": {"hsts": kwargs.get("frontend_hsts", False)},
                "acl": kwargs.get("acl")  # Always include acl, even if None
            },
            "proxy_connect_timeout": kwargs.get("proxy_connect_timeout", 60),
            "proxy_read_timeout": kwargs.get("proxy_read_timeout", 60),
            "proxy_send_timeout": kwargs.get("proxy_send_timeout", 60),
            "proxy_http_version": kwargs.get("proxy_http_version", 1),
            "proxy_intercept_errors": kwargs.get("proxy_intercept_errors", False),
            "customize_headers": customize_headers,
        }
        return rule

