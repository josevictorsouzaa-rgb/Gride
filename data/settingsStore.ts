
import { User } from '../types';

export interface CountingSettings {
  dailyTarget: number;
  cooldownDays: number; // Intervalo minimo entre contagens
  highGiroThreshold: number; // Mínimo de saídas para considerar alto giro
  accumulationMode: boolean; // Se deve somar meta atrasada
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
  dailyTarget: 150,
  cooldownDays: 30,
  highGiroThreshold: 5,
  accumulationMode: true
};

export const getSettings = (): CountingSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (stored) {
        const parsed = JSON.parse(stored);
        return { 
          dailyTarget: parsed.dailyTarget ?? DEFAULT_SETTINGS.dailyTarget,
          cooldownDays: parsed.cooldownDays ?? DEFAULT_SETTINGS.cooldownDays,
          highGiroThreshold: parsed.highGiroThreshold ?? DEFAULT_SETTINGS.highGiroThreshold,
          accumulationMode: parsed.accumulationMode ?? DEFAULT_SETTINGS.accumulationMode
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
  const currentSettings = getSettings();
  const history = getSettingsHistory();
  const changes: string[] = [];

  if (currentSettings.dailyTarget !== newSettings.dailyTarget) {
    changes.push(`Meta Diária: ${currentSettings.dailyTarget} -> ${newSettings.dailyTarget}`);
  }
  if (currentSettings.cooldownDays !== newSettings.cooldownDays) {
    changes.push(`Cooldown (Dias): ${currentSettings.cooldownDays} -> ${newSettings.cooldownDays}`);
  }
  if (currentSettings.highGiroThreshold !== newSettings.highGiroThreshold) {
    changes.push(`Giro Alto: ${currentSettings.highGiroThreshold} -> ${newSettings.highGiroThreshold}`);
  }
  if (currentSettings.accumulationMode !== newSettings.accumulationMode) {
    changes.push(`Acumulativo: ${currentSettings.accumulationMode} -> ${newSettings.accumulationMode}`);
  }

  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));

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
