"""API routes for reverse proxy rule CRUD operations."""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.api.dependencies import get_mgr, get_current_user
from app.core.synology import SynoReverseProxyManager
from app.models.schemas import ReverseProxyRule

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("")
def list_rules(
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user)
):
    """List all reverse proxy rules."""
    try:
        return mgr.list_rules()
    except HTTPException:
        # Re-raise HTTPException (e.g., from get_mgr() for auth errors)
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list rules: {str(e)}")


@router.get("/{rule_id}")
def get_rule(
    rule_id: str,
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user)
):
    """Get a single reverse proxy rule by ID."""
    try:
        result = mgr.get_rule(rule_id)
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=f"Rule not found: {result}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get rule: {str(e)}")


@router.post("")
def create_rule(
    rule: ReverseProxyRule,
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user)
):
    """Create a new reverse proxy rule."""
    try:
        rule_obj = mgr.build_rule(**rule.dict())
        result = mgr.create_rule(rule_obj)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=str(result))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create rule: {str(e)}")


@router.put("/{rule_id}")
def update_rule(
    rule_id: str,
    rule: ReverseProxyRule,
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user)
):
    """Update an existing reverse proxy rule."""
    try:
        rule_obj = mgr.build_rule(**rule.dict())
        result = mgr.update_rule(rule_id, rule_obj)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=str(result))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update rule: {str(e)}")


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: str,
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user)
):
    """Delete a single reverse proxy rule by ID."""
    try:
        result = mgr.delete_rule(rule_id)
        
        # Check for actual deletion success
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=str(result))
        
        # Additional check: some APIs return success but with error details
        if result.get("error"):
            raise HTTPException(status_code=400, detail=str(result.get("error")))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete rule: {str(e)}")


@router.post("/bulk-delete")
def bulk_delete_rules(
    rule_ids: List[str],
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user)
):
    """Delete multiple reverse proxy rules by IDs."""
    try:
        if not rule_ids or len(rule_ids) == 0:
            raise HTTPException(status_code=400, detail="No rule IDs provided")
        
        result = mgr.delete_rules(rule_ids)
        
        # Check for actual deletion success
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=str(result))
        
        # Additional check: some APIs return success but with error details
        if result.get("error"):
            raise HTTPException(status_code=400, detail=str(result.get("error")))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete rules: {str(e)}")

