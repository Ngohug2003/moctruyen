import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import { createCloud } from './client';

const storage = {
  get: (key: string) => {
    if (Platform.OS === 'web') {
      try {
        return Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
      } catch {
        return Promise.resolve(null);
      }
    }
    return Storage.getItem(key);
  },
  set: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      } catch {}
      return Promise.resolve();
    }
    return Storage.setItem(key, value);
  },
};

const secure = {
  get: (key: string) => {
    if (Platform.OS === 'web') {
      try {
        return Promise.resolve(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null);
      } catch {
        return Promise.resolve(null);
      }
    }
    return SecureStore.getItemAsync(key);
  },
  set: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
      } catch {}
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
};

export const cloud = createCloud(
  storage,
  secure,
  process.env.EXPO_PUBLIC_API_URL || 'http://3.104.65.209:8000',
);
