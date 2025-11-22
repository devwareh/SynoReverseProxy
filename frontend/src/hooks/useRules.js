import { useState, useEffect, useCallback } from 'react';
import { rulesAPI } from '../utils/api';

/**
 * Custom hook to manage rules state and operations
 */
function useRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rulesAPI.getAll();
      const entries = res.data.data?.entries || [];
      setRules(entries);
      return { success: true, data: entries };
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      let errorMsg;
      if (typeof errorDetail === 'object' && errorDetail !== null) {
        errorMsg = errorDetail.message || errorDetail.error || JSON.stringify(errorDetail);
      } else if (errorDetail) {
        errorMsg = String(errorDetail);
      } else {
        errorMsg = err.message || String(err);
      }
      setError(errorMsg);
      return { success: false, error: errorMsg, requiresAuth: err.response?.status === 401 };
    } finally {
      setLoading(false);
    }
  }, []);

  const createRule = useCallback(async (ruleData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await rulesAPI.create(ruleData);
      await fetchRules();
      return { success: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchRules]);

  const updateRule = useCallback(async (id, ruleData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await rulesAPI.update(id, ruleData);
      await fetchRules();
      return { success: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchRules]);

  const deleteRule = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await rulesAPI.delete(id);
      await fetchRules();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchRules]);

  const bulkDeleteRules = useCallback(async (ids) => {
    setLoading(true);
    setError(null);
    try {
      await rulesAPI.bulkDelete(ids);
      await fetchRules();
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchRules]);

  const getRuleById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await rulesAPI.getById(id);
      return { success: true, data: res.data.data?.entry };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const validateRule = useCallback(async (ruleData, excludeId = null) => {
    try {
      const res = await rulesAPI.validate(ruleData, excludeId);
      return res.data;
    } catch (err) {
      return {
        valid: false,
        errors: [err.response?.data?.detail || err.message || "Validation failed"]
      };
    }
  }, []);

  const exportRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rulesAPI.export();
      return { success: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const importRules = useCallback(async (rulesData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await rulesAPI.import(rulesData);
      await fetchRules();
      return { success: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchRules]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    loading,
    error,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    bulkDeleteRules,
    getRuleById,
    validateRule,
    exportRules,
    importRules,
  };
}

export default useRules;

