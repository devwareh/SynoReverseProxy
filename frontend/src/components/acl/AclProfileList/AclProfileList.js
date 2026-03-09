import React, { useState } from "react";
import PropTypes from "prop-types";
import { FiPlus, FiTrash2, FiEdit2, FiLock } from "react-icons/fi";
import { Button } from "../../common";
import ConfirmDialog from "../../modals/ConfirmDialog/ConfirmDialog";

function AclProfileList({ profiles, loading, onEdit, onDelete, onNew }) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const handleDelete = (uuid, name) => {
    setConfirmDialog({ uuid, name });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDialog) return;
    const { uuid } = confirmDialog;
    setConfirmDialog(null);
    setDeletingId(uuid);
    try {
      await onDelete(uuid);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="acl-loading">Loading profiles…</div>;
  }

  if (profiles.length === 0) {
    return (
      <div className="acl-empty">
        <FiLock className="acl-empty-icon" />
        <p className="acl-empty-title">No access control profiles</p>
        <p className="acl-empty-hint">Create a profile to restrict rules to specific IPs or subnets.</p>
        <Button variant="primary" onClick={onNew} icon={<FiPlus />}>
          Create your first profile
        </Button>
      </div>
    );
  }

  return (
    <>
      <ul className="acl-profile-list">
        {profiles.map((profile) => {
          const hasRules = (profile.rules?.length || 0) > 0;
          const hasAllow = profile.rules?.some((r) => r.access);
          const hasDeny = profile.rules?.some((r) => !r.access);
          return (
            <li
              key={profile.UUID}
              className={`acl-profile-card${hasAllow && hasDeny ? " mixed" : hasAllow ? " allow" : hasDeny ? " deny" : ""}`}
            >
              <div className="acl-card-top">
                <span className="acl-card-name">{profile.name}</span>
                <div className="acl-card-actions">
                  <button
                    type="button"
                    className="acl-card-btn"
                    onClick={() => onEdit(profile)}
                    aria-label={`Edit ${profile.name}`}
                    title="Edit"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    type="button"
                    className="acl-card-btn acl-card-btn-delete"
                    onClick={() => handleDelete(profile.UUID, profile.name)}
                    disabled={deletingId === profile.UUID}
                    aria-label={`Delete ${profile.name}`}
                    title="Delete"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
              {hasRules ? (
                <div className="acl-card-rules">
                  {profile.rules.map((r, i) => (
                    <span key={`${profile.UUID}-${r.access ? "allow" : "deny"}-${r.address || "all"}-${i}`} className={`acl-rule-pill ${r.access ? "allow" : "deny"}`}>
                      <span className="acl-pill-label">{r.access ? "Allow" : "Deny"}</span>
                      <span className="acl-pill-addr">{r.address || "All"}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="acl-card-no-rules">No rules — add some to restrict access</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="acl-list-footer">
        <Button variant="secondary" onClick={onNew} icon={<FiPlus />}>
          New Profile
        </Button>
      </div>
      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDeleteAction}
          title="Delete Profile"
          message={`Delete "${confirmDialog.name}"? Rules assigned to this profile will no longer be access-controlled.`}
          variant="danger"
          confirmText="Delete"
        />
      )}
    </>
  );
}

AclProfileList.propTypes = {
  profiles: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onNew: PropTypes.func.isRequired,
};

export default AclProfileList;
