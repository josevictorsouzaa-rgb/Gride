import { User } from '../types';

export interface CountingSettings {
  curveA: number;
  curveB: number;
  curveC: number;
  dailyTarget: number;
}

export interface SettingsHistoryEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  user: string;
  avatar?: string;
  changes: string[];
}

const STORAGE_KEY_SETTINGS = 'li_app_settings_v1';
const STORAGE_KEY_HISTORY = 'li_app_settings_history_v1';

const DEFAULT_SETTINGS: CountingSettings = {
  curveA: 50,
  curveB: 30,
  curveC: 20,
  dailyTarget: 150
};

export const getSettings = (): CountingSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const getSettingsHistory = (): SettingsHistoryEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveSettings = (newSettings: CountingSettings, user: User | null) => {
  const currentSettings = getSettings();
  const history = getSettingsHistory();
  const changes: string[] = [];

  // Detect Changes
  if (currentSettings.curveA !== newSettings.curveA) {
    changes.push(`Curva A alterada de ${currentSettings.curveA}% para ${newSettings.curveA}%`);
  }
  if (currentSettings.curveB !== newSettings.curveB) {
    changes.push(`Curva B alterada de ${currentSettings.curveB}% para ${newSettings.curveB}%`);
  }
  if (currentSettings.curveC !== newSettings.curveC) {
    changes.push(`Curva C alterada de ${currentSettings.curveC}% para ${newSettings.curveC}%`);
  }
  if (currentSettings.dailyTarget !== newSettings.dailyTarget) {
    changes.push(`Meta Diária alterada de ${currentSettings.dailyTarget} para ${newSettings.dailyTarget}`);
  }

  // Save Settings
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));

  // If there were changes, add to history
  if (changes.length > 0) {
    const newEntry: SettingsHistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString('pt-BR'),
      user: user?.name || 'Sistema',
      avatar: user?.avatar,
      changes: changes
    };

    const newHistory = [newEntry, ...history];
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
    return newHistory;
  }

  return history;
};
