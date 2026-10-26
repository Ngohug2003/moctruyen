import { useEffect, useState } from 'react';
export function navigate(path: string) {
  window.dispatchEvent(new Event('moc:before-navigate'));
  window.location.hash = path;
}
export function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash.slice(1) || '/');
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route.split('/').filter(Boolean);
}
