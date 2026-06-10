export type TrustedClient = {
  clientId: string;
  redirectUrls: string[];
  skipConsent?: boolean;
  clientSecret?: string;
  metadata?: Record<string, unknown>;
};
