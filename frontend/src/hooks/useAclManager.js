import { useState, useCallback } from "react";

/**
 * Manages the ACL Manager modal visibility and version counter.
 * The version counter is incremented each time the modal closes,
 * allowing dependent components (e.g. RuleForm ACL dropdown) to
 * re-fetch the profile list.
 */
export default function useAclManager() {
  const [showAclManager, setShowAclManager] = useState(false);
  const [aclVersion, setAclVersion] = useState(0);

  const openAclManager = useCallback(() => {
    setShowAclManager(true);
  }, []);

  const closeAclManager = useCallback(() => {
    setShowAclManager(false);
    setAclVersion((v) => v + 1);
  }, []);

  return { showAclManager, aclVersion, openAclManager, closeAclManager };
}
