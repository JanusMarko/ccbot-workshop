import { useEffect, useState } from "react";

const TABLET_BREAKPOINT = 1024;

export function useResponsive() {
  const [isTablet, setIsTablet] = useState(
    () => window.innerWidth <= TABLET_BREAKPOINT,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { isTablet };
}
