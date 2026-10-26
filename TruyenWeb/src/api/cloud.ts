import { createCloud } from './client';
const storage = {
  get: async (key: string) => localStorage.getItem(key),
  set: async (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
};
const credentials = {
  get: async (key: string) => sessionStorage.getItem(key),
  set: async (key: string, value: string) => {
    sessionStorage.setItem(key, value);
  },
};
export const cloud = createCloud(
  storage,
  credentials,
  import.meta.env.VITE_API_URL ?? `http://${location.hostname}:8000`,
);
window.addEventListener('online', () => {
  void cloud.sync();
});
window.addEventListener('focus', () => {
  void cloud.sync();
});
