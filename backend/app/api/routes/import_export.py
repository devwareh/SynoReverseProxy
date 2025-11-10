"""API routes for import, export, and validation operations."""
import time
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any
from app.api.dependencies import get_mgr
from app.core.synology import SynoReverseProxyManager
from app.models.schemas import ReverseProxyRule

router = APIRouter(prefix="/rules", tags=["import-export"])


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
    """Import rules from JSON. Expects {'rules': [list of rule objects]}."""
    try:
        # Handle both direct rules array and wrapped format
        if isinstance(rules_data, list):
            rules = rules_data
        else:
            rules = rules_data.get("rules", [])
        
        if not rules:
            raise HTTPException(status_code=400, detail="No rules provided in import data")
        
        results = {
            "success": True,
            "total": len(rules),
            "created": 0,
            "failed": 0,
            "errors": []
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
                create_result = mgr.create_rule(rule_obj)
                if create_result.get("success"):
                    results["created"] += 1
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

