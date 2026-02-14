import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiClock, FiLoader, FiRotateCw, FiX } from 'react-icons/fi';
import Button from '../../common/Button/Button';
import Badge from '../../common/Badge/Badge';
import './OperationsPanel.css';

const statusLabel = {
  queued: 'Queued',
  running: 'Running',
  verifying: 'Verifying',
  failed: 'Failed',
  succeeded: 'Done',
};

const statusVariant = {
  queued: 'warning',
  running: 'default',
  verifying: 'http',
  failed: 'error',
  succeeded: 'success',
};

function OperationRow({ operation, onRetryOperation, onDismissOperation }) {
  const active =
    operation.status === 'queued' ||
    operation.status === 'running' ||
    operation.status === 'verifying';

  return (
    <div className={`operation-row operation-${operation.status} ${operation.autoClearing ? 'operation-auto-clearing' : ''}`}>
      <div className="operation-main">
        <div className="operation-title">
          <span className="operation-kind">{operation.kind.toUpperCase()}</span>
          <span className="operation-target">{operation.targetLabel}</span>
        </div>
        <div className="operation-meta">
          <span
            className={`operation-status-icon ${
              active ? 'operation-status-active' : `operation-status-${operation.status}`
            }`}
            aria-hidden="true"
          >
            {active ? <FiLoader /> : operation.status === 'succeeded' ? <FiCheckCircle /> : <FiAlertTriangle />}
          </span>
          <Badge variant={statusVariant[operation.status] || 'default'} size="small">
            {statusLabel[operation.status] || operation.status}
          </Badge>
          <span className="operation-attempts">Attempt {operation.attempts}</span>
          {operation.errorMessage && <span className="operation-error">{operation.errorMessage}</span>}
        </div>
      </div>
      <div className="operation-actions">
        {operation.status === 'failed' && operation.recoverable && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => onRetryOperation(operation.id)}
            ariaLabel={`Retry operation ${operation.id}`}
          >
            <FiRotateCw /> Retry
          </Button>
        )}
        {(operation.status === 'failed' || operation.status === 'succeeded') && (
          <Button
            variant="icon"
            size="small"
            onClick={() => onDismissOperation(operation.id)}
            ariaLabel={`Dismiss operation ${operation.id}`}
          >
            <FiX />
          </Button>
        )}
      </div>
    </div>
  );
}

OperationRow.propTypes = {
  operation: PropTypes.shape({
    id: PropTypes.string.isRequired,
    kind: PropTypes.string.isRequired,
    targetLabel: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    attempts: PropTypes.number.isRequired,
    recoverable: PropTypes.bool,
    errorMessage: PropTypes.string,
  }).isRequired,
  onRetryOperation: PropTypes.func.isRequired,
  onDismissOperation: PropTypes.func.isRequired,
};

const OperationsPanel = ({
  operations,
  operationSummary,
  onRetryOperation,
  onDismissOperation,
  onClearCompletedOperations,
  onAutoClearPauseChange,
}) => {
  if (!operations || operations.length === 0) {
    return null;
  }

  return (
    <section
      className="operations-panel"
      aria-label="Operations panel"
      onMouseEnter={() => onAutoClearPauseChange?.(true)}
      onMouseLeave={() => onAutoClearPauseChange?.(false)}
      onFocusCapture={() => onAutoClearPauseChange?.(true)}
      onBlurCapture={(e) => {
        const next = e.relatedTarget;
        if (!e.currentTarget.contains(next)) {
          onAutoClearPauseChange?.(false);
        }
      }}
    >
      <div className="operations-header">
        <h3>
          <FiActivity /> Operations
        </h3>
        <div className="operations-summary" aria-label="operations summary">
          <span><FiClock /> Running: {operationSummary.running}</span>
          <span><FiRotateCw /> Verifying: {operationSummary.verifying}</span>
          <span><FiAlertTriangle /> Failed: {operationSummary.failed}</span>
          <span><FiCheckCircle /> Done: {operationSummary.succeeded}</span>
        </div>
        {operationSummary.succeeded > 0 && (
          <Button
            variant="secondary"
            size="small"
            onClick={onClearCompletedOperations}
            ariaLabel="Clear completed operations"
          >
            Clear Completed
          </Button>
        )}
      </div>

      <div className="operations-list">
        {operations.map((operation) => (
          <OperationRow
            key={operation.id}
            operation={operation}
            onRetryOperation={onRetryOperation}
            onDismissOperation={onDismissOperation}
          />
        ))}
      </div>
    </section>
  );
};

OperationsPanel.propTypes = {
  operations: PropTypes.arrayOf(PropTypes.object).isRequired,
  operationSummary: PropTypes.shape({
    queued: PropTypes.number,
    running: PropTypes.number,
    verifying: PropTypes.number,
    failed: PropTypes.number,
    succeeded: PropTypes.number,
  }).isRequired,
  onRetryOperation: PropTypes.func.isRequired,
  onDismissOperation: PropTypes.func.isRequired,
  onClearCompletedOperations: PropTypes.func.isRequired,
  onAutoClearPauseChange: PropTypes.func,
};

export default memo(OperationsPanel);
