/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" shows made-up data and needs neither login nor the API. */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
