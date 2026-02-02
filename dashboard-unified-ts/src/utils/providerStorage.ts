// Utility functions for storing and retrieving provider information

import { Provider } from '../types';

const PROVIDER_ID_KEY = 'dashboard_provider_id';
const PROVIDER_INFO_KEY = 'dashboard_provider_info';
const WELCOME_SHOWN_KEY_PREFIX = 'dashboard_welcome_shown_';

export function saveProviderInfo(provider: Provider): void {
  localStorage.setItem(PROVIDER_ID_KEY, provider.id);
  localStorage.setItem(PROVIDER_INFO_KEY, JSON.stringify(provider));
}

export function loadProviderInfo(): { id: string; info: Provider } | null {
  const providerId = localStorage.getItem(PROVIDER_ID_KEY);
  const providerInfoStr = localStorage.getItem(PROVIDER_INFO_KEY);
  
  if (providerId && providerInfoStr) {
    try {
      const info = JSON.parse(providerInfoStr) as Provider;
      return { id: providerId, info };
    } catch (e) {
      console.error('Error loading provider info:', e);
      clearProviderInfo();
      return null;
    }
  }
  return null;
}

export function clearProviderInfo(): void {
  localStorage.removeItem(PROVIDER_ID_KEY);
  localStorage.removeItem(PROVIDER_INFO_KEY);
}

export function hasSeenWelcome(providerId: string): boolean {
  const key = `${WELCOME_SHOWN_KEY_PREFIX}${providerId}`;
  return localStorage.getItem(key) === 'true';
}

export function markWelcomeAsSeen(providerId: string): void {
  const key = `${WELCOME_SHOWN_KEY_PREFIX}${providerId}`;
  localStorage.setItem(key, 'true');
}
