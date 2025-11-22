"""API routes for import, export, and validation operations."""
import time
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any, List
from app.api.dependencies import get_mgr
from app.core.synology import SynoReverseProxyManager
from app.models.schemas import ReverseProxyRule

router = APIRouter(prefix="/rules", tags=["import-export"])


def _normalize_rule_for_comparison(rule: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a rule dictionary for comparison.
    
    Handles None vs empty lists/objects, sorts headers, and normalizes data types.
    """
    normalized = rule.copy()
    
    # Normalize customize_headers: None -> []
    if normalized.get("customize_headers") is None:
        normalized["customize_headers"] = []
    
    # Sort headers by name for consistent comparison
    if isinstance(normalized.get("customize_headers"), list):
        normalized["customize_headers"] = sorted(
            normalized["customize_headers"],
            key=lambda h: (h.get("name", ""), h.get("value", ""))
        )
    
    # Normalize frontend.https.hsts: ensure boolean
    frontend = normalized.get("frontend", {})
    if isinstance(frontend, dict):
        https = frontend.get("https", {})
        if isinstance(https, dict):
            https["hsts"] = bool(https.get("hsts", False))
        else:
            frontend["https"] = {"hsts": False}
        normalized["frontend"] = frontend
    
    # Normalize acl: None -> None (keep as None, but ensure consistent comparison)
    # We'll handle None vs missing key in comparison
    if "acl" in normalized.get("frontend", {}) and normalized["frontend"]["acl"] is None:
        # Keep None as None for comparison
        pass
    
    # Ensure numeric fields are integers
    numeric_fields = [
        "proxy_connect_timeout", "proxy_read_timeout", "proxy_send_timeout",
        "proxy_http_version"
    ]
    for field in numeric_fields:
        if field in normalized:
            normalized[field] = int(normalized[field]) if normalized[field] is not None else 60
    
    # Ensure boolean fields are booleans
    if "proxy_intercept_errors" in normalized:
        normalized["proxy_intercept_errors"] = bool(normalized.get("proxy_intercept_errors", False))
    
    return normalized


def _rules_match_exactly(rule1: Dict[str, Any], rule2: Dict[str, Any]) -> bool:
    """Check if two rules match exactly (all fields identical)."""
    norm1 = _normalize_rule_for_comparison(rule1)
    norm2 = _normalize_rule_for_comparison(rule2)
    
    # Compare backend
    backend1 = norm1.get("backend", {})
    backend2 = norm2.get("backend", {})
    if (backend1.get("fqdn") != backend2.get("fqdn") or
        backend1.get("port") != backend2.get("port") or
        backend1.get("protocol") != backend2.get("protocol")):
        return False
    
    # Compare frontend
    frontend1 = norm1.get("frontend", {})
    frontend2 = norm2.get("frontend", {})
    if (frontend1.get("fqdn") != frontend2.get("fqdn") or
        frontend1.get("port") != frontend2.get("port") or
        frontend1.get("protocol") != frontend2.get("protocol")):
        return False
    
    # Compare HSTS
    hsts1 = frontend1.get("https", {}).get("hsts", False)
    hsts2 = frontend2.get("https", {}).get("hsts", False)
    if hsts1 != hsts2:
        return False
    
    # Compare ACL (handle None vs missing)
    acl1 = frontend1.get("acl")
    acl2 = frontend2.get("acl")
    if acl1 != acl2:
        return False
    
    # Compare customize_headers
    headers1 = norm1.get("customize_headers", [])
    headers2 = norm2.get("customize_headers", [])
    if headers1 != headers2:
        return False
    
    # Compare proxy settings
    if (norm1.get("proxy_connect_timeout") != norm2.get("proxy_connect_timeout") or
        norm1.get("proxy_read_timeout") != norm2.get("proxy_read_timeout") or
        norm1.get("proxy_send_timeout") != norm2.get("proxy_send_timeout") or
        norm1.get("proxy_http_version") != norm2.get("proxy_http_version") or
        norm1.get("proxy_intercept_errors") != norm2.get("proxy_intercept_errors")):
        return False
    
    return True


def _check_duplicate_rule(new_rule: Dict[str, Any], existing_rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Check if a new rule conflicts with or duplicates an existing rule.
    
    Returns:
        {
            'is_conflict': bool,      # Same frontend FQDN + port (will be rejected)
            'is_exact_duplicate': bool, # All fields match exactly
            'existing_rule_id': str,    # UUID of matching rule
            'reason': str,              # 'conflict' or 'exact_duplicate'
            'frontend': str             # Frontend FQDN:port for reference
        }
    """
    new_frontend = new_rule.get("frontend", {})
    new_fqdn = new_frontend.get("fqdn")
    new_port = new_frontend.get("port")
    
    for existing in existing_rules:
        existing_frontend = existing.get("frontend", {})
        existing_fqdn = existing_frontend.get("fqdn")
        existing_port = existing_frontend.get("port")
        
        # Check for conflict: same frontend FQDN + port
        if existing_fqdn == new_fqdn and existing_port == new_port:
            existing_id = existing.get("UUID") or existing.get("uuid") or existing.get("id")
            
            # Check if it's an exact duplicate
            if _rules_match_exactly(new_rule, existing):
                return {
                    'is_conflict': True,
                    'is_exact_duplicate': True,
                    'existing_rule_id': existing_id,
                    'reason': 'exact_duplicate',
                    'frontend': f"{new_fqdn}:{new_port}"
                }
            else:
                # Conflict but not exact duplicate (same frontend, different config)
                return {
                    'is_conflict': True,
                    'is_exact_duplicate': False,
                    'existing_rule_id': existing_id,
                    'reason': 'conflict',
                    'frontend': f"{new_fqdn}:{new_port}"
                }
    
    # No conflict found
    return {
        'is_conflict': False,
        'is_exact_duplicate': False,
        'existing_rule_id': None,
        'reason': None,
        'frontend': None
    }


@router.get("/export")
def export_rules(mgr: SynoReverseProxyManager = Depends(get_mgr)):
    """Export all rules as JSON."""
    try:
        result = mgr.list_rules()
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=str(result))
        
        entries = result.get("data", {}).get("entries", [])
        return {
            "success": True,
            "count": len(entries),
            "exported_at": time.time(),
            "rules": entries
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export rules: {str(e)}")


@router.post("/import")
async def import_rules(rules_data: Dict[str, Any], mgr: SynoReverseProxyManager = Depends(get_mgr)):
    """Import rules from JSON. Expects {'rules': [list of rule objects]}.
    
    Checks for duplicates before creating rules:
    - Skips rules with conflicts (same frontend FQDN + port)
    - Skips exact duplicates (all fields match)
    - Reports skipped rules in results
    """
    try:
        # Handle both direct rules array and wrapped format
        if isinstance(rules_data, list):
            rules = rules_data
        else:
            rules = rules_data.get("rules", [])
        
        if not rules:
            raise HTTPException(status_code=400, detail="No rules provided in import data")
        
        # Fetch existing rules once at the start
        existing_rules_result = mgr.list_rules()
        existing_rules = []
        if existing_rules_result.get("success"):
            existing_rules = existing_rules_result.get("data", {}).get("entries", [])
        
        results = {
            "success": True,
            "total": len(rules),
            "created": 0,
            "skipped": 0,
            "failed": 0,
            "errors": [],
            "skipped_rules": []
        }
        
        for rule in rules:
            try:
                # Extract rule data and build rule object
                rule_obj = mgr.build_rule(
                    description=rule.get("description", "Imported Rule"),
                    backend_fqdn=rule.get("backend", {}).get("fqdn", ""),
                    backend_port=rule.get("backend", {}).get("port", 5000),
                    frontend_fqdn=rule.get("frontend", {}).get("fqdn", ""),
                    frontend_port=rule.get("frontend", {}).get("port", 443),
                    backend_protocol=rule.get("backend", {}).get("protocol", 0),
                    frontend_protocol=rule.get("frontend", {}).get("protocol", 1),
                    frontend_hsts=rule.get("frontend", {}).get("https", {}).get("hsts", False),
                    customize_headers=rule.get("customize_headers", []),
                    proxy_connect_timeout=rule.get("proxy_connect_timeout", 60),
                    proxy_read_timeout=rule.get("proxy_read_timeout", 60),
                    proxy_send_timeout=rule.get("proxy_send_timeout", 60),
                    proxy_http_version=rule.get("proxy_http_version", 1),
                    proxy_intercept_errors=rule.get("proxy_intercept_errors", False),
                    acl=rule.get("frontend", {}).get("acl")
                )
                
                # Check for duplicates before attempting to create
                duplicate_check = _check_duplicate_rule(rule_obj, existing_rules)
                
                if duplicate_check["is_conflict"]:
                    # Skip duplicate/conflicting rule
                    results["skipped"] += 1
                    results["skipped_rules"].append({
                        "rule": rule.get("description", "Unknown"),
                        "reason": duplicate_check["reason"],
                        "existing_rule_id": duplicate_check["existing_rule_id"],
                        "frontend": duplicate_check["frontend"]
                    })
                    continue
                
                # No duplicate found, attempt to create
                create_result = mgr.create_rule(rule_obj)
                if create_result.get("success"):
                    results["created"] += 1
                    # Refresh existing rules list to include the newly created rule
                    # This prevents false positives for subsequent rules in the same import
                    existing_rules_result = mgr.list_rules()
                    if existing_rules_result.get("success"):
                        existing_rules = existing_rules_result.get("data", {}).get("entries", [])
                else:
                    results["failed"] += 1
                    results["errors"].append({
                        "rule": rule.get("description", "Unknown"),
                        "error": create_result.get("error", "Unknown error")
                    })
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "rule": rule.get("description", "Unknown"),
                    "error": str(e)
                })
        
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import rules: {str(e)}")


@router.post("/validate")
def validate_rule(
    rule: ReverseProxyRule, 
    exclude_rule_id: Optional[str] = Query(None),
    mgr: SynoReverseProxyManager = Depends(get_mgr)
):
    """Validate a rule and check for conflicts (duplicate frontend FQDN+port)."""
    try:
        validation_result = {
            "valid": True,
            "conflicts": [],
            "errors": []
        }
        
        # Check for conflicts: same frontend FQDN + port combination
        all_rules = mgr.list_rules()
        if all_rules.get("success"):
            entries = all_rules.get("data", {}).get("entries", [])
            frontend_fqdn = rule.frontend_fqdn
            frontend_port = rule.frontend_port
            
            for entry in entries:
                # Skip the rule being updated
                entry_id = entry.get("UUID") or entry.get("uuid") or entry.get("id")
                if exclude_rule_id and entry_id == exclude_rule_id:
                    continue
                
                entry_frontend = entry.get("frontend", {})
                if (entry_frontend.get("fqdn") == frontend_fqdn and 
                    entry_frontend.get("port") == frontend_port):
                    validation_result["valid"] = False
                    validation_result["conflicts"].append({
                        "rule_id": entry_id,
                        "description": entry.get("description", "Unnamed Rule"),
                        "frontend": f"{frontend_fqdn}:{frontend_port}"
                    })
        
        # Basic validation
        if not rule.frontend_fqdn:
            validation_result["valid"] = False
            validation_result["errors"].append("Frontend FQDN is required")
        
        if not rule.backend_fqdn:
            validation_result["valid"] = False
            validation_result["errors"].append("Backend FQDN is required")
        
        if not (1 <= rule.frontend_port <= 65535):
            validation_result["valid"] = False
            validation_result["errors"].append("Frontend port must be between 1 and 65535")
        
        if not (1 <= rule.backend_port <= 65535):
            validation_result["valid"] = False
            validation_result["errors"].append("Backend port must be between 1 and 65535")
        
        return validation_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate rule: {str(e)}")

