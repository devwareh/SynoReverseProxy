import React, { memo, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiEdit2, FiTrash2, FiCopy, FiShield } from "react-icons/fi";
import Checkbox from "../../common/Checkbox/Checkbox";
import Badge from "../../common/Badge/Badge";
import Button from "../../common/Button/Button";
import RulePath from "../RulePath/RulePath";
import RuleMeta from "../RuleMeta/RuleMeta";
import "./RuleCard.css";

const RuleCard = ({
  rule,
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  loading = false,
  operationState = null,
  onRetryRuleOperation,
}) => {
  const ruleId = rule.UUID || rule.uuid || rule.id;
  const frontendProtocol = rule.frontend?.protocol === 1 ? "HTTPS" : "HTTP";
  const backendProtocol = rule.backend?.protocol === 1 ? "HTTPS" : "HTTP";
  const frontendPort = rule.frontend?.port || 443;
  const backendPort = rule.backend?.port || 5000;
  const frontendScheme = frontendProtocol.toLowerCase();
  const frontendFqdn = rule.frontend?.fqdn;
  const frontendHref = frontendFqdn ? `${frontendScheme}://${frontendFqdn}` : null;

  const rowBusy =
    operationState &&
    (operationState.status === "queued" ||
      operationState.status === "running" ||
      operationState.status === "verifying");

  const canRetry =
    operationState &&
    operationState.status === "failed" &&
    operationState.recoverable &&
    operationState.operationId &&
    typeof onRetryRuleOperation === "function";

  const [tickMs, setTickMs] = useState(Date.now());

  useEffect(() => {
    if (!rowBusy) return undefined;
    const timer = setInterval(() => setTickMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, [rowBusy]);

  const elapsedMs = operationState?.startedAt ? Math.max(0, tickMs - operationState.startedAt) : 0;
  const progressPercent = (() => {
    const status = operationState?.status;
    if (!status) return 0;
    if (status === "queued") return 12;
    if (status === "running") return Math.min(88, 18 + elapsedMs / 140);
    if (status === "verifying") return Math.min(96, 70 + elapsedMs / 220);
    if (status === "succeeded") return 100;
    if (status === "failed") return 100;
    return 0;
  })();

  const handleSelect = () => {
    onSelect(ruleId);
  };

  const handleEdit = () => {
    onEdit(ruleId);
  };

  const handleDelete = () => {
    onDelete(ruleId, rule.description || "Unnamed Rule");
  };

  const handleDuplicate = () => {
    onDuplicate(ruleId);
  };

  const handleRetry = () => {
    if (canRetry) {
      onRetryRuleOperation(operationState.operationId);
    }
  };

  return (
    <article
      className={`rule-card ${isSelected ? "selected" : ""} ${rowBusy ? "rule-card-busy" : ""}`}
      aria-labelledby={`rule-title-${ruleId}`}
    >
      <div className="rule-checkbox">
        <Checkbox
          checked={isSelected}
          onChange={handleSelect}
          disabled={loading || rowBusy}
          aria-label={`Select rule: ${rule.description || "Unnamed Rule"}`}
        />
      </div>
      <div className="rule-header">
        <div className="rule-title-section">
          <h3 id={`rule-title-${ruleId}`}>{rule.description || "Unnamed Rule"}</h3>
          <div className="rule-badges">
            <Badge variant={frontendProtocol.toLowerCase()} size="small">
              {frontendProtocol}
            </Badge>
            {rule.frontend?.https?.hsts && (
              <Badge variant="hsts" size="small" icon={<FiShield />}>
                HSTS
              </Badge>
            )}
            {operationState?.status && (
              <Badge variant={operationState.status === "failed" ? "error" : operationState.status === "succeeded" ? "success" : "warning"} size="small">
                {String(operationState.status).toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
        <div className="rule-actions">
          <Button
            variant="icon"
            onClick={handleDuplicate}
            ariaLabel="Duplicate rule"
            disabled={loading || rowBusy}
            className="btn-duplicate"
          >
            <FiCopy />
          </Button>
          <Button
            variant="icon"
            onClick={handleEdit}
            ariaLabel="Edit rule"
            disabled={loading || rowBusy}
            className="btn-edit"
          >
            <FiEdit2 />
          </Button>
          <Button
            variant="icon"
            onClick={handleDelete}
            ariaLabel="Delete rule"
            disabled={loading || rowBusy}
            className="btn-delete"
          >
            <FiTrash2 />
          </Button>
        </div>
      </div>
      <div className="rule-body">
        {operationState?.status && (
          <div
            className={`rule-progress rule-progress-${operationState.status}`}
            role="progressbar"
            aria-label={`Operation progress for ${rule.description || "rule"}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
          >
            <div className="rule-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        {operationState?.message && (
          <p className="rule-operation-message">{operationState.message}</p>
        )}
        {canRetry && (
          <div className="rule-operation-actions">
            <Button
              variant="secondary"
              size="small"
              onClick={handleRetry}
              ariaLabel={`Retry operation for ${rule.description || "rule"}`}
            >
              Retry
            </Button>
          </div>
        )}
        <RulePath
          frontend={{
            protocol: frontendProtocol,
            fqdn: frontendFqdn,
            port: frontendPort,
          }}
          backend={{
            protocol: backendProtocol,
            fqdn: rule.backend?.fqdn,
            port: backendPort,
          }}
        />
        <RuleMeta
          connectTimeout={rule.proxy_connect_timeout || 60}
          readTimeout={rule.proxy_read_timeout || 60}
          sendTimeout={rule.proxy_send_timeout || 60}
          customHeadersCount={rule.customize_headers?.length || 0}
        />
        {frontendHref && (
          <div className="rule-footer">
            <a
              href={frontendHref}
              target="_blank"
              rel="noopener noreferrer"
              className="domain-pill"
              title={`Open ${frontendScheme}://${frontendFqdn} in a new tab`}
              onClick={(event) => event.stopPropagation()}
            >
              {frontendFqdn}
            </a>
          </div>
        )}
      </div>
    </article>
  );
};

RuleCard.propTypes = {
  rule: PropTypes.shape({
    UUID: PropTypes.string,
    uuid: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    frontend: PropTypes.shape({
      protocol: PropTypes.number,
      port: PropTypes.number,
      fqdn: PropTypes.string,
      https: PropTypes.shape({
        hsts: PropTypes.bool,
      }),
    }),
    backend: PropTypes.shape({
      protocol: PropTypes.number,
      port: PropTypes.number,
      fqdn: PropTypes.string,
    }),
    proxy_connect_timeout: PropTypes.number,
    proxy_read_timeout: PropTypes.number,
    proxy_send_timeout: PropTypes.number,
    customize_headers: PropTypes.array,
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onDuplicate: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  operationState: PropTypes.shape({
    status: PropTypes.string,
    operationId: PropTypes.string,
    message: PropTypes.string,
    recoverable: PropTypes.bool,
  }),
  onRetryRuleOperation: PropTypes.func,
};

export default memo(RuleCard);
