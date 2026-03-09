import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { FiX, FiLock, FiArrowLeft } from "react-icons/fi";
import { Button } from "../../common";
import { aclAPI } from "../../../utils/api";
import { toErrorString } from "../../../utils/errors";
import AclProfileList from "../AclProfileList";
import AclProfileForm from "../AclProfileForm";
import "./AclManager.css";

function AclManager({ onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null); // null | "new" | { uuid, name }

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aclAPI.getAll();
      setProfiles(res.data?.data?.entries || []);
    } catch (err) {
      setError(toErrorString(err, "Failed to load ACL profiles"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const openNew = () => {
    setEditingProfile("new");
    setError(null);
  };

  const openEdit = (profile) => {
    setEditingProfile({ uuid: profile.UUID, name: profile.name, rules: profile.rules || [] });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingProfile(null);
    setError(null);
  };

  const handleSave = async (uuid, payload) => {
    if (uuid) {
      await aclAPI.update(uuid, payload);
    } else {
      await aclAPI.create(payload);
    }
    setEditingProfile(null);
    await fetchProfiles();
  };

  const handleDelete = async (uuid) => {
    try {
      await aclAPI.delete(uuid);
      await fetchProfiles();
    } catch (err) {
      setError(toErrorString(err, "Failed to delete profile"));
    }
  };

  const isEditing = editingProfile !== null;
  const initialName = editingProfile === "new" ? "" : editingProfile?.name || "";
  const initialRules = editingProfile === "new" ? [] : editingProfile?.rules || [];

  return (
    <div className="acl-manager">
      {/* Header */}
      <div className="acl-manager-header">
        {isEditing ? (
          <button type="button" className="acl-back-btn" onClick={cancelEdit}>
            <FiArrowLeft />
            <span>All Profiles</span>
          </button>
        ) : (
          <div className="acl-manager-title">
            <FiLock className="acl-manager-icon" />
            <h2>Access Control Profiles</h2>
          </div>
        )}
        <Button variant="icon" onClick={onClose} ariaLabel="Close">
          <FiX />
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="acl-error" role="alert">
          <FiX className="acl-error-icon" /> {error}
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <AclProfileForm
          key={editingProfile === "new" ? "new" : editingProfile.uuid}
          editingProfile={editingProfile}
          onSave={handleSave}
          onCancel={cancelEdit}
          initialName={initialName}
          initialRules={initialRules}
        />
      ) : (
        <AclProfileList
          profiles={profiles}
          loading={loading}
          onEdit={openEdit}
          onDelete={handleDelete}
          onNew={openNew}
        />
      )}
    </div>
  );
}

AclManager.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default AclManager;
