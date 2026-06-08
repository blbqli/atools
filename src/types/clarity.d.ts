declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & {
      q?: unknown[][];
    };
    __atoolsClarityLoaded?: boolean;
  }
}

export {};
