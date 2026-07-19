export {};

declare global {
  interface Window {
    dataLayer: any[];
    adsbygoogle: any[];
    gtag: (...args: any[]) => void;
    _inter_close: any;
    ttq: any;
  }
}
