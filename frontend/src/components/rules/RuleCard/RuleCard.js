import React, { memo } from "react";
import PropTypes from "prop-types";
import { FiEdit2, FiTrash2, FiCopy, FiGlobe, FiServer, FiArrowRight, FiShield, FiClock, FiCode } from "react-icons/fi";
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
}) => {
  const ruleId = rule.UUID || rule.uuid || rule.id;
  const frontendProtocol = rule.frontend?.protocol === 1 ? "HTTPS" : "HTTP";
  const backendProtocol = rule.backend?.protocol === 1 ? "HTTPS" : "HTTP";
  const frontendPort = rule.frontend?.port || 443;
  const backendPort = rule.backend?.port || 5000;
  const frontendScheme = frontendProtocol.toLowerCase();
  const frontendFqdn = rule.frontend?.fqdn;
  const frontendHref = frontendFqdn ? `${frontendScheme}://${frontendFqdn}` : null;

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

  return (
    <article className={`rule-card ${isSelected ? "selected" : ""}`} aria-labelledby={`rule-title-${ruleId}`}>
      <div className="rule-checkbox">
        <Checkbox
          checked={isSelected}
          onChange={handleSelect}
          disabled={loading}
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
          </div>
        </div>
        <div className="rule-actions">
          <Button
            variant="icon"
            onClick={handleDuplicate}
            ariaLabel="Duplicate rule"
            disabled={loading}
            className="btn-duplicate"
          >
            <FiCopy />
          </Button>
          <Button
            variant="icon"
            onClick={handleEdit}
            ariaLabel="Edit rule"
            disabled={loading}
            className="btn-edit"
          >
            <FiEdit2 />
          </Button>
          <Button
            variant="icon"
            onClick={handleDelete}
            ariaLabel="Delete rule"
            disabled={loading}
            className="btn-delete"
          >
            <FiTrash2 />
          </Button>
        </div>
      </div>
      <div className="rule-body">
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
};

export default memo(RuleCard);

