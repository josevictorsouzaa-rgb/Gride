
import { User } from '../types';

export interface CountingSettings {
  // Configurações futuras podem vir aqui
  dummy?: boolean; 
}

export interface SettingsHistoryEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  user: string;
  avatar?: string;
  changes: string[];
}

const STORAGE_KEY_SETTINGS = 'li_app_settings_v2';
const STORAGE_KEY_HISTORY = 'li_app_settings_history_v1';

const DEFAULT_SETTINGS: CountingSettings = {
  dummy: true
};

export const getSettings = (): CountingSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (stored) {
        const parsed = JSON.parse(stored);
        return { 
          dummy: true
        };
    }
    return DEFAULT_SETTINGS;
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
  const history = getSettingsHistory();
  const changes: string[] = [];

  // Detect Changes - Simplified as there are no meta settings
  changes.push('Configurações atualizadas');

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
