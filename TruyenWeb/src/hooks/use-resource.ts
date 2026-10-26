import { useEffect, useState } from 'react';
export function useResource<T>(key: string, loader: () => Promise<T>) {
  const [result, setResult] = useState<{ key: string; value?: T; error?: string }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loader()
      .then((value) => {
        if (active) setResult({ key, value });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            key,
            error: error instanceof Error ? error.message : 'Chưa tải được dữ liệu. Hãy thử lại.',
          });
      });
    return () => {
      active = false;
    };
  }, [key, loader, attempt]);
  return {
    value: result.key === key ? result.value : undefined,
    error: result.key === key ? result.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
}
