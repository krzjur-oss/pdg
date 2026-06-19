/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface JournalEntry {
  id: string;
  title: string;
  content: string; // Markdown body
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
  tags: string[];
  mood: 'neutral' | 'happy' | 'excited' | 'sad' | 'tired' | 'peaceful';
  weather: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'stormy' | 'none';
  createdAt: string;
  updatedAt: string;
}

export interface SyncConfig {
  isSupported: boolean;
  isSyncing: boolean;
  folderName: string | null;
  lastSyncedAt: string | null;
  error: string | null;
}

export type DictationLanguage = 'pl-PL' | 'en-US' | 'de-DE' | 'es-ES' | 'fr-FR';

export interface VoiceCommand {
  phrase: string;
  action: string;
  replacement: string;
  category: 'editing' | 'punctuation' | 'formatting';
}
