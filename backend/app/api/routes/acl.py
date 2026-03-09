"""API routes for ACL (Access Control List) profile CRUD."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from app.api.dependencies import get_mgr, get_current_user
from app.core.synology import SynoReverseProxyManager
from app.models.schemas import AclProfile
from app.utils.validators import is_valid_uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/acl", tags=["acl"])


def _validate_uuid(uuid: str) -> None:
    if not is_valid_uuid(uuid):
        raise HTTPException(status_code=422, detail="Invalid UUID format")


@router.get("")
def list_acl_profiles(
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user),
):
    """List all ACL profiles."""
    try:
        return mgr.list_acl_profiles()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to list ACL profiles: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list ACL profiles")


@router.post("")
def create_acl_profile(
    profile: AclProfile,
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user),
):
    """Create a new ACL profile."""
    try:
        rules = [r.model_dump() for r in profile.rules]
        result = mgr.create_acl_profile(profile.name, rules)
        if not result.get("success"):
            logger.warning("NAS rejected ACL profile create: %s", result)
            raise HTTPException(status_code=400, detail="Failed to create ACL profile")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create ACL profile: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create ACL profile")


@router.put("/{uuid}")
def update_acl_profile(
    uuid: str,
    profile: AclProfile,
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user),
):
    """Update an existing ACL profile."""
    _validate_uuid(uuid)
    try:
        rules = [r.model_dump() for r in profile.rules]
        result = mgr.update_acl_profile(uuid, profile.name, rules)
        if not result.get("success"):
            error_code = result.get("error", {}).get("code")
            logger.warning("NAS rejected ACL profile update (uuid=%s): %s", uuid, result)
            status = 404 if error_code == 404 else 400
            detail = "ACL profile not found" if status == 404 else "Failed to update ACL profile"
            raise HTTPException(status_code=status, detail=detail)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update ACL profile (uuid=%s): %s", uuid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update ACL profile")


@router.delete("/{uuid}")
def delete_acl_profile(
    uuid: str,
    mgr: SynoReverseProxyManager = Depends(get_mgr),
    _: str = Depends(get_current_user),
):
    """Delete an ACL profile by UUID.

    Note: The manager's delete_acl_profiles() accepts a list for batch deletes,
    but this route intentionally exposes single-UUID deletes only. Add a
    separate bulk-delete endpoint if batch operations are needed later.
    """
    _validate_uuid(uuid)
    try:
        result = mgr.delete_acl_profiles([uuid])
        if not result.get("success"):
            logger.warning("NAS rejected ACL profile delete (uuid=%s): %s", uuid, result)
            raise HTTPException(status_code=400, detail="Failed to delete ACL profile")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete ACL profile (uuid=%s): %s", uuid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete ACL profile")
