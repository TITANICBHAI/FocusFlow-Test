import { useCallback, useEffect, useRef, useState } from 'react';
import { navPush } from '@/utils/nav';

/**
 * Drop-in navigation handler that gives the pressed control immediate
 * feedback and prevents repeated presses while navigation is in flight.
 */
export function useNavPress(href: string | object) {
  const [loading, setLoading] = useState(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPress = useCallback(() => {
    if (loading) return;
    setLoading(true);

    // Let the loading state render before starting navigation work.
    requestAnimationFrame(() => {
      const fired = navPush(href);
      if (!fired) setLoading(false);
    });

    // If the current screen stays mounted, avoid leaving the control disabled.
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = setTimeout(() => setLoading(false), 1_000);
  }, [href, loading]);

  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  return { onPress, loading };
}