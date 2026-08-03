import React from 'react';
import { AppPickerSheet } from './AppPickerSheet';
import { useApp } from '@/context/AppContext';
import type { AllowedAppPreset } from '@/data/types';

interface Props {
  visible: boolean;
  allowedPackages: string[];
  onSave: (packages: string[]) => void | Promise<void>;
  onClose: () => void;
}

export function AllowedAppsModal({ visible, allowedPackages, onSave, onClose }: Props) {
  const { state, updateSettings } = useApp();
  const presets: AllowedAppPreset[] = state.settings.allowedAppPresets ?? [];

  const handleSavePreset = async (preset: AllowedAppPreset) => {
    const newPresets = [...presets, preset];
    await updateSettings({ ...state.settings, allowedAppPresets: newPresets });
  };

  const handleDeletePreset = async (id: string) => {
    const newPresets = presets.filter((p) => p.id !== id);
    await updateSettings({ ...state.settings, allowedAppPresets: newPresets });
  };

  return (
    <AppPickerSheet
      visible={visible}
      title="Allowed During Focus"
      initialSelected={allowedPackages}
      noneWhenEmpty
      presets={presets}
      onSave={(packages) => { void onSave(packages); }}
      onSavePreset={(preset) => { void handleSavePreset(preset); }}
      onDeletePreset={(id) => { void handleDeletePreset(id); }}
      onClose={onClose}
    />
  );
}
