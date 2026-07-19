export type CookieConsentChoice = "accepted" | "rejected" | null;

export type ClarityFunction = ((...args: unknown[]) => void) & {
  q?: unknown[][];
};
