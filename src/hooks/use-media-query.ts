"use client";

import { useEffect, useState } from "react";

/**
 * Client-side hook that tracks whether a CSS media query matches.
 * Returns `false` during SSR / initial hydration to prevent layout shift.
 *
 * @param query - A valid CSS media query string, e.g. "(max-width: 768px)"
 * @returns `true` when the media query matches, `false` otherwise.
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 768px)");
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // window.matchMedia is undefined in SSR environments; guard defensively
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQueryList = window.matchMedia(query);

    // Set the initial value once the component mounts on the client
    setMatches(mediaQueryList.matches);

    /** Update state whenever the query result changes. */
    function handleChange(event: MediaQueryListEvent): void {
      setMatches(event.matches);
    }

    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}
