import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { rulesAPI } from '../utils/api';

const AMBIGUOUS_ERROR_CODES = new Set([117, 4154]);
const ASYNC_MUTATION_UX_ENABLED = process.env.REACT_APP_ASYNC_MUTATION_UX !== 'false';
const AUTO_CLEAR_COMPLETED_MS = 12000;
const AUTO_CLEAR_EXIT_ANIM_MS = 450;

const now = () => Date.now();
const opId = () => `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function extractDetail(err) {
  return err?.response?.data?.detail;
}

function extractErrorCode(detail) {
  if (!detail) return null;
  if (typeof detail === 'number') return detail;
  if (typeof detail === 'string') {
    const match = detail.match(/\b(117|4154)\b/);
    return match ? Number(match[1]) : null;
  }
  if (typeof detail === 'object') {
    if (typeof detail.code === 'number') return detail.code;
    if (typeof detail?.error?.code === 'number') return detail.error.code;
    if (typeof detail?.error?.errors?.code === 'number') return detail.error.errors.code;
  }
  return null;
}

function normalizeError(err) {
  const detail = extractDetail(err);
  const status = err?.response?.status || null;
  const code = extractErrorCode(detail);
  const message =
    (typeof detail === 'string' && detail) ||
    detail?.message ||
    detail?.error ||
    err?.message ||
    'Request failed';
  const timeout = err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''));
  const network = !err?.response;
  const serverError = typeof status === 'number' && status >= 500;
  return { status, code, message: String(message), timeout, network, serverError };
}

function isAmbiguousError(errorInfo) {
  if (!errorInfo) return false;
  return (
    errorInfo.timeout ||
    errorInfo.network ||
    errorInfo.serverError ||
    AMBIGUOUS_ERROR_CODES.has(errorInfo.code)
  );
}

function getRuleId(rule) {
  return rule?.UUID || rule?.uuid || rule?.id || null;
}

const UPDATE_VERIFY_ACCESSORS = {
  description: (rule) => rule?.description,
  frontend_fqdn: (rule) => rule?.frontend?.fqdn,
  frontend_port: (rule) => rule?.frontend?.port,
  frontend_protocol: (rule) => rule?.frontend?.protocol,
  frontend_hsts: (rule) => rule?.frontend?.https?.hsts,
  backend_fqdn: (rule) => rule?.backend?.fqdn,
  backend_port: (rule) => rule?.backend?.port,
  backend_protocol: (rule) => rule?.backend?.protocol,
  proxy_connect_timeout: (rule) => rule?.proxy_connect_timeout,
  proxy_read_timeout: (rule) => rule?.proxy_read_timeout,
  proxy_send_timeout: (rule) => rule?.proxy_send_timeout,
  proxy_http_version: (rule) => rule?.proxy_http_version,
  proxy_intercept_errors: (rule) => rule?.proxy_intercept_errors,
  customize_headers: (rule) => rule?.customize_headers,
  acl: (rule) => rule?.frontend?.acl,
};

const NUMBER_FIELDS = new Set([
  'frontend_port',
  'frontend_protocol',
  'backend_port',
  'backend_protocol',
  'proxy_connect_timeout',
  'proxy_read_timeout',
  'proxy_send_timeout',
  'proxy_http_version',
]);

const BOOLEAN_FIELDS = new Set([
  'frontend_hsts',
  'proxy_intercept_errors',
]);

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered === 'true' || lowered === '1';
  }
  return Boolean(value);
}

function normalizeHeaders(headers) {
  if (!Array.isArray(headers)) return [];
  return headers.map((item) => ({
    name: item?.name ?? '',
    value: item?.value ?? '',
  }));
}

function stableNormalize(value) {
  if (Array.isArray(value)) return value.map((item) => stableNormalize(item));
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableNormalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function normalizeFieldValue(field, value) {
  if (field === 'customize_headers') return normalizeHeaders(value);
  if (NUMBER_FIELDS.has(field)) return Number(value);
  if (BOOLEAN_FIELDS.has(field)) return normalizeBoolean(value);
  if (field === 'acl') return stableNormalize(value);
  return value;
}

function valuesEqual(left, right) {
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return JSON.stringify(stableNormalize(left)) === JSON.stringify(stableNormalize(right));
}

function didRuleApplyUpdate(ruleData, foundRule) {
  if (!ruleData || typeof ruleData !== 'object') return false;
  const fields = Object.keys(ruleData).filter((key) => ruleData[key] !== undefined);
  if (fields.length === 0) return false;

  return fields.every((field) => {
    const accessor = UPDATE_VERIFY_ACCESSORS[field];
    if (!accessor) return false;
    const expected = normalizeFieldValue(field, ruleData[field]);
    const actual = normalizeFieldValue(field, accessor(foundRule));
    return valuesEqual(expected, actual);
  });
}

/**
 * Custom hook to manage rules state and operations.
 */
function useRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [operations, setOperations] = useState([]);
  const [autoClearPaused, setAutoClearPausedState] = useState(false);
  const operationsRef = useRef([]);
  const completedTimersRef = useRef(new Map());

  const setOperationsSafe = useCallback((updater) => {
    setOperations((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      operationsRef.current = next;
      return next;
    });
  }, []);

  const updateOperation = useCallback((id, updater) => {
    setOperationsSafe((prev) =>
      prev.map((op) => {
        if (op.id !== id) return op;
        const patch = typeof updater === 'function' ? updater(op) : updater;
        return { ...op, ...patch };
      })
    );
  }, [setOperationsSafe]);

  const fetchRules = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, []);

  const findRuleByFrontendFqdn = useCallback(async (fqdn) => {
    const list = await rulesAPI.getAll();
    const entries = list.data?.data?.entries || [];
    const found = entries.find((entry) => entry?.frontend?.fqdn === fqdn);
    return found || null;
  }, []);

  const findRuleById = useCallback(async (id) => {
    const list = await rulesAPI.getAll();
    const entries = list.data?.data?.entries || [];
    return entries.find((entry) => getRuleId(entry) === id) || null;
  }, []);

  const createOperation = useCallback((kind, targetLabel, targetRuleId, retryPayload) => {
    const operation = {
      id: opId(),
      kind,
      targetRuleId: targetRuleId || null,
      targetLabel: targetLabel || 'Rule operation',
      status: 'queued',
      startedAt: now(),
      finishedAt: null,
      attempts: 0,
      errorCode: null,
      errorMessage: null,
      recoverable: true,
      autoClearing: false,
      retryPayload,
    };
    setOperationsSafe((prev) => [operation, ...prev]);
    return operation.id;
  }, [setOperationsSafe]);

  const performMutationWithVerification = useCallback(async ({ operationId, execute, verify }) => {
    updateOperation(operationId, (op) => ({
      status: 'running',
      startedAt: op.startedAt || now(),
      attempts: op.attempts + 1,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      recoverable: true,
      autoClearing: false,
    }));

    try {
      const data = await execute();
      updateOperation(operationId, {
        status: 'succeeded',
        finishedAt: now(),
        recoverable: false,
      });
      return { success: true, data };
    } catch (err) {
      const errorInfo = normalizeError(err);
      const ambiguous = ASYNC_MUTATION_UX_ENABLED && isAmbiguousError(errorInfo);

      if (ambiguous) {
        updateOperation(operationId, {
          status: 'verifying',
          errorCode: errorInfo.code,
          errorMessage: `${errorInfo.message} (verifying current state...)`,
          recoverable: true,
        });

        try {
          const verification = await verify();
          if (verification?.verified) {
            updateOperation(operationId, {
              status: 'succeeded',
              finishedAt: now(),
              errorCode: null,
              errorMessage: null,
              recoverable: false,
              autoClearing: false,
              ...(verification.ruleId ? { targetRuleId: verification.ruleId } : {}),
            });
            return { success: true, data: verification.data || null, recovered: true };
          }
        } catch {
          // verification failed; continue to failed state below
        }
      }

      updateOperation(operationId, {
        status: 'failed',
        finishedAt: now(),
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        recoverable: true,
        autoClearing: false,
      });
      setError(errorInfo.message);
      return { success: false, error: errorInfo.message, errorCode: errorInfo.code };
    }
  }, [updateOperation]);

  const runCreateRule = useCallback(async (ruleData, existingOperationId = null, options = {}) => {
    const background = options.background === true;
    const targetLabel = options.targetLabel || ruleData?.description || ruleData?.frontend_fqdn || 'Create rule';
    const operationId =
      existingOperationId ||
      createOperation('create', targetLabel, null, {
        ruleData,
        targetLabel,
      });

    const run = async () => {
      let existingRuleId = null;
      try {
        const existingRule = await findRuleByFrontendFqdn(ruleData?.frontend_fqdn);
        existingRuleId = getRuleId(existingRule);
      } catch (err) {
        const errorInfo = normalizeError(err);
        updateOperation(operationId, {
          status: 'failed',
          finishedAt: now(),
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          recoverable: true,
          autoClearing: false,
        });
        setError(errorInfo.message);
        return { success: false, error: errorInfo.message, errorCode: errorInfo.code };
      }

      const result = await performMutationWithVerification({
        operationId,
        execute: async () => {
          const res = await rulesAPI.create(ruleData);
          return res.data;
        },
        verify: async () => {
          const found = await findRuleByFrontendFqdn(ruleData?.frontend_fqdn);
          const foundRuleId = getRuleId(found);
          const sameRuleAlreadyExisted =
            Boolean(existingRuleId) && Boolean(foundRuleId) && existingRuleId === foundRuleId;
          const payloadMatches = found ? didRuleApplyUpdate(ruleData, found) : false;
          return {
            verified: Boolean(found) && payloadMatches && !sameRuleAlreadyExisted,
            ruleId: foundRuleId,
            data: found,
          };
        },
      });

      if (result.success) {
        await fetchRules({ silent: true });
      }

      return result;
    };

    if (background) {
      void run();
      return { success: true, pending: true, operationId };
    }

    return run();
  }, [createOperation, fetchRules, findRuleByFrontendFqdn, performMutationWithVerification, updateOperation]);

  const runUpdateRule = useCallback(async (id, ruleData, existingOperationId = null, options = {}) => {
    const background = options.background === true;
    const targetLabel = options.targetLabel || ruleData?.description || `Rule ${id}`;
    const operationId =
      existingOperationId ||
      createOperation('update', targetLabel, id, {
        id,
        ruleData,
        targetLabel,
      });

    const run = async () => {
      const result = await performMutationWithVerification({
        operationId,
        execute: async () => {
          const res = await rulesAPI.update(id, ruleData);
          return res.data;
        },
        verify: async () => {
          const found = await findRuleById(id);
          if (!found) return { verified: false };
          return {
            verified: didRuleApplyUpdate(ruleData, found),
            ruleId: id,
            data: found,
          };
        },
      });

      if (result.success) {
        await fetchRules({ silent: true });
      }

      return result;
    };

    if (background) {
      void run();
      return { success: true, pending: true, operationId };
    }

    return run();
  }, [createOperation, fetchRules, findRuleById, performMutationWithVerification]);

  const runDeleteRule = useCallback(async (id, existingOperationId = null, options = {}) => {
    const background = options.background === true;
    const targetLabel = options.targetLabel || `Rule ${id}`;
    const operationId =
      existingOperationId ||
      createOperation('delete', targetLabel, id, {
        id,
        targetLabel,
      });

    const run = async () => {
      const result = await performMutationWithVerification({
        operationId,
        execute: async () => {
          await rulesAPI.delete(id);
          return null;
        },
        verify: async () => {
          const found = await findRuleById(id);
          return {
            verified: !found,
            ruleId: id,
          };
        },
      });

      if (result.success) {
        await fetchRules({ silent: true });
      }

      return result;
    };

    if (background) {
      void run();
      return { success: true, pending: true, operationId };
    }

    return run();
  }, [createOperation, fetchRules, findRuleById, performMutationWithVerification]);

  const runBulkDeleteRules = useCallback(async (ids, existingOperationId = null, options = {}) => {
    const background = options.background === true;
    const targetLabel = options.targetLabel || `Delete ${ids.length} rule(s)`;
    const operationId =
      existingOperationId ||
      createOperation('bulk-delete', targetLabel, null, {
        ids,
        targetLabel,
      });

    const run = async () => {
      const result = await performMutationWithVerification({
        operationId,
        execute: async () => {
          await rulesAPI.bulkDelete(ids);
          return null;
        },
        verify: async () => {
          const list = await rulesAPI.getAll();
          const entries = list.data?.data?.entries || [];
          const existingIds = new Set(entries.map((entry) => getRuleId(entry)));
          const allDeleted = ids.every((id) => !existingIds.has(id));
          return {
            verified: allDeleted,
          };
        },
      });

      if (result.success) {
        await fetchRules({ silent: true });
      }

      return result;
    };

    if (background) {
      void run();
      return { success: true, pending: true, operationId };
    }

    return run();
  }, [createOperation, fetchRules, performMutationWithVerification]);

  const createRule = useCallback(async (ruleData, options = {}) => runCreateRule(ruleData, null, options), [runCreateRule]);

  const updateRule = useCallback(async (id, ruleData, options = {}) => runUpdateRule(id, ruleData, null, options), [runUpdateRule]);

  const deleteRule = useCallback(async (id, options = {}) => runDeleteRule(id, null, options), [runDeleteRule]);

  const bulkDeleteRules = useCallback(async (ids, options = {}) => runBulkDeleteRules(ids, null, options), [runBulkDeleteRules]);

  const retryOperation = useCallback(async (operationId) => {
    const op = operationsRef.current.find((item) => item.id === operationId);
    if (!op || !op.retryPayload) {
      return { success: false, error: 'Operation cannot be retried' };
    }

    if (op.kind === 'create') {
      return runCreateRule(op.retryPayload.ruleData, operationId, { targetLabel: op.retryPayload.targetLabel });
    }
    if (op.kind === 'update') {
      return runUpdateRule(op.retryPayload.id, op.retryPayload.ruleData, operationId, {
        targetLabel: op.retryPayload.targetLabel,
      });
    }
    if (op.kind === 'delete') {
      return runDeleteRule(op.retryPayload.id, operationId, { targetLabel: op.retryPayload.targetLabel });
    }
    if (op.kind === 'bulk-delete') {
      return runBulkDeleteRules(op.retryPayload.ids, operationId, { targetLabel: op.retryPayload.targetLabel });
    }

    return { success: false, error: 'Unsupported operation type' };
  }, [runBulkDeleteRules, runCreateRule, runDeleteRule, runUpdateRule]);

  const dismissOperation = useCallback((operationId) => {
    const timer = completedTimersRef.current.get(operationId);
    if (timer) {
      clearTimeout(timer.fadeTimer);
      clearTimeout(timer.removeTimer);
      completedTimersRef.current.delete(operationId);
    }
    setOperationsSafe((prev) => prev.filter((op) => op.id !== operationId));
  }, [setOperationsSafe]);

  const clearCompletedOperations = useCallback(() => {
    completedTimersRef.current.forEach((t) => {
      clearTimeout(t.fadeTimer);
      clearTimeout(t.removeTimer);
    });
    completedTimersRef.current.clear();
    setOperationsSafe((prev) => prev.filter((op) => op.status !== 'succeeded'));
  }, [setOperationsSafe]);

  const setAutoClearPaused = useCallback((paused) => {
    if (paused) {
      completedTimersRef.current.forEach((t) => {
        clearTimeout(t.fadeTimer);
        clearTimeout(t.removeTimer);
      });
      completedTimersRef.current.clear();
    }
    setAutoClearPausedState(Boolean(paused));
  }, []);

  useEffect(() => {
    if (autoClearPaused) {
      completedTimersRef.current.forEach((t) => {
        clearTimeout(t.fadeTimer);
        clearTimeout(t.removeTimer);
      });
      completedTimersRef.current.clear();
      return undefined;
    }
    const timers = completedTimersRef.current;
    const succeededIds = new Set(
      operations.filter((op) => op.status === 'succeeded').map((op) => op.id)
    );

    operations.forEach((op) => {
      if (op.status === 'succeeded' && !timers.has(op.id)) {
        const fadeDelay = Math.max(0, AUTO_CLEAR_COMPLETED_MS - AUTO_CLEAR_EXIT_ANIM_MS);
        const fadeTimer = setTimeout(() => {
          updateOperation(op.id, { autoClearing: true });
        }, fadeDelay);
        const removeTimer = setTimeout(() => {
          setOperationsSafe((prev) => prev.filter((item) => item.id !== op.id));
          completedTimersRef.current.delete(op.id);
        }, AUTO_CLEAR_COMPLETED_MS);
        timers.set(op.id, { fadeTimer, removeTimer });
      }
    });

    Array.from(timers.keys()).forEach((id) => {
      if (!succeededIds.has(id)) {
        const existing = timers.get(id);
        clearTimeout(existing.fadeTimer);
        clearTimeout(existing.removeTimer);
        timers.delete(id);
      }
    });
  }, [autoClearPaused, operations, setOperationsSafe, updateOperation]);

  useEffect(() => () => {
    completedTimersRef.current.forEach((t) => {
      clearTimeout(t.fadeTimer);
      clearTimeout(t.removeTimer);
    });
    completedTimersRef.current.clear();
  }, []);

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
        errors: [err.response?.data?.detail || err.message || 'Validation failed'],
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
      await fetchRules({ silent: true });
      return { success: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchRules]);

  const operationSummary = useMemo(() => {
    const summary = { queued: 0, running: 0, verifying: 0, failed: 0, succeeded: 0 };
    operations.forEach((op) => {
      if (summary[op.status] !== undefined) {
        summary[op.status] += 1;
      }
    });
    return summary;
  }, [operations]);

  const operationStateByRuleId = useMemo(() => {
    const state = {};
    operations.forEach((op) => {
      if (!op.targetRuleId) return;
      const existing = state[op.targetRuleId];
      if (!existing || op.startedAt >= existing.startedAt) {
        state[op.targetRuleId] = {
          status: op.status,
          operationId: op.id,
          message: op.errorMessage || '',
          recoverable: op.recoverable,
          startedAt: op.startedAt,
        };
      }
    });
    return state;
  }, [operations]);

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
    operations,
    operationSummary,
    retryOperation,
    dismissOperation,
    clearCompletedOperations,
    setAutoClearPaused,
    operationStateByRuleId,
  };
}

export default useRules;
