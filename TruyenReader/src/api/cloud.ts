import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { createCloud } from './client';
const storage = {
  get: (key: string) => Storage.getItem(key),
  set: (key: string, value: string) => Storage.setItem(key, value),
};
const secure = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};
export const cloud = createCloud(
  storage,
  secure,
  process.env.EXPO_PUBLIC_API_URL || 'https://moctruyen.onrender.com',
);
