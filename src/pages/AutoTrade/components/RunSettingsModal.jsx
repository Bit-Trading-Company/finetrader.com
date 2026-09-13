/**
 * The run settings, in a dialog — the wizard's way in. The dashboard shows
 * the same fields inline instead.
 */
import React from 'react';
import { Button, Modal } from '../../../ui';
import RunSettingsFields from './RunSettingsFields';

const RunSettingsModal = ({ open, onClose, settings, isTrading }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Run settings"
    description="These apply to every strategy."
    footer={<Button onClick={onClose}>Done</Button>}
  >
    <RunSettingsFields settings={settings} isTrading={isTrading} />
  </Modal>
);

export default RunSettingsModal;
