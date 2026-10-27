/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** mock — справочники из мока по контракту вместо бэка */
  readonly VITE_DICTIONARIES_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
