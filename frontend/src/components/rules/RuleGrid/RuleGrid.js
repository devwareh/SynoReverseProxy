import React, { memo } from "react";
import PropTypes from "prop-types";
import RuleCard from "../RuleCard/RuleCard";
import SkeletonLoader from "../../empty-states/SkeletonLoader/SkeletonLoader";
import "./RuleGrid.css";

const RuleGrid = ({
  rules,
  selectedRules,
  onSelectRule,
  onEditRule,
  onDeleteRule,
  onDuplicateRule,
  loading = false,
  skeletonCount = 3,
}) => {
  if (loading && rules.length === 0) {
    return (
      <div className="rules-grid">
        <SkeletonLoader count={skeletonCount} />
      </div>
    );
  }

  if (rules.length === 0) {
    return null;
  }

  return (
    <div className="rules-grid">
      {rules.map((rule, index) => {
        const ruleId = rule.UUID || rule.uuid || rule.id;
        const isSelected = selectedRules.has(ruleId);

        return (
          <RuleCard
            key={ruleId || index}
            rule={rule}
            isSelected={isSelected}
            onSelect={onSelectRule}
            onEdit={onEditRule}
            onDelete={onDeleteRule}
            onDuplicate={onDuplicateRule}
            loading={loading}
          />
        );
      })}
    </div>
  );
};

RuleGrid.propTypes = {
  rules: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedRules: PropTypes.instanceOf(Set).isRequired,
  onSelectRule: PropTypes.func.isRequired,
  onEditRule: PropTypes.func.isRequired,
  onDeleteRule: PropTypes.func.isRequired,
  onDuplicateRule: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  skeletonCount: PropTypes.number,
};

export default memo(RuleGrid);
