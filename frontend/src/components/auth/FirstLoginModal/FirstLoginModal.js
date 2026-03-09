import React from "react";
import PropTypes from "prop-types";
import { FiShield } from "react-icons/fi";
import { Button, Input } from "../../common";
import Modal from "../../modals/Modal/Modal";

function FirstLoginModal({
  isOpen,
  isReauth,
  otpCode,
  onOtpChange,
  loading,
  onCancel,
  onSubmit,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={
        <>
          <FiShield /> {isReauth ? "Re-authenticate with NAS" : "2FA Authentication Required"}
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={loading}
            disabled={loading || otpCode.trim().length === 0}
          >
            {isReauth ? "Re-authenticate" : "Authenticate"}
          </Button>
        </>
      }
    >
      <p>
        {isReauth
          ? "Your NAS session has expired. Please enter the current OTP code from your authenticator app to reconnect."
          : "Your Synology account has two-factor authentication enabled. Please enter the current OTP code from your authenticator app to complete setup."}
      </p>
      <Input
        label="OTP Code"
        id="otp-code"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        required
        value={otpCode}
        onChange={(e) => onOtpChange(e.target.value)}
        placeholder="Enter 6-digit OTP code"
        maxLength={6}
        onKeyPress={(e) => {
          if (e.key === "Enter" && !loading && otpCode.trim().length > 0) {
            onSubmit();
          }
        }}
      />
    </Modal>
  );
}

FirstLoginModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  isReauth: PropTypes.bool.isRequired,
  otpCode: PropTypes.string.isRequired,
  onOtpChange: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default FirstLoginModal;

