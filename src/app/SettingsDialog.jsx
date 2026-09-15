/**
 * The app's settings, in one dialog reachable from every screen.
 *
 * Categories rather than one long form: what a run does, where it talks to the
 * chain, and how the app looks are three different questions, and someone
 * opening this usually knows which one they came for.
 *
 * Mounted once by the shell. `SettingsDialogContext` says whether it is open
 * and which section to land on; the run settings come from
 * `RunSettingsContext` so the dialog shows the values the engine is actually
 * using, whatever page it was opened from.
 */
import React from 'react';
import { Button, Modal, SettingsLayout } from '../ui';
import { BoltIcon, EyeIcon, GlobeIcon, ToolsIcon } from '../ui/icons';
import { useRunSettings } from '../features/trading/RunSettingsContext';
import RunSettingsFields from '../features/trading/RunSettingsFields';
import NetworkSettingsFields from '../features/trading/NetworkSettingsFields';
import DisplaySettingsFields from './DisplaySettingsFields';
import TroubleshootingFields from './TroubleshootingFields';
import { DIALOG, useDialogs } from './DialogContext';

const SettingsDialog = () => {
  const { isDialogOpen, payload: section, closeDialog } = useDialogs();
  const open = isDialogOpen(DIALOG.settings);
  const settings = useRunSettings();
  // Reported by the auto-trader; locks the fields a live run is reading.
  const isTrading = settings.runActive;

  const sections = [
    {
      id: 'run',
      label: 'Run',
      icon: <BoltIcon size={16} />,
      description: 'These apply to every strategy the auto-trader runs.',
      render: () => (
        <RunSettingsFields settings={settings} isTrading={isTrading} />
      ),
    },
    {
      id: 'network',
      label: 'Network',
      icon: <GlobeIcon size={16} />,
      description: 'Where balances, fee rates and broadcasts go.',
      render: () => <NetworkSettingsFields settings={settings} />,
    },
    {
      id: 'display',
      label: 'Display',
      icon: <EyeIcon size={16} />,
      description: 'How the app looks. None of this changes what a run does.',
      render: () => <DisplaySettingsFields />,
    },
    {
      id: 'troubleshooting',
      label: 'Troubleshooting',
      icon: <ToolsIcon size={16} />,
      description:
        'For when a browser is carrying state from an older build of the app.',
      render: () => <TroubleshootingFields />,
    },
  ];

  return (
    <Modal
      open={open}
      onClose={closeDialog}
      size="lg"
      title="Settings"
      footer={<Button onClick={closeDialog}>Done</Button>}
    >
      {/*
        Keyed on the section so re-opening at a different one re-mounts the
        layout on that section rather than keeping its last internal choice.
      */}
      <SettingsLayout
        key={section || 'default'}
        sections={sections}
        defaultSection={section || undefined}
      />
    </Modal>
  );
};

export default SettingsDialog;
