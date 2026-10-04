// Self-contained so `common` can be type-checked without depending on `vite`.
// When bundled by client/extension, this interface merges with their `vite/client` types.
interface ImportMetaEnv {
    readonly MODE: string;
    readonly VITE_APP_VERSION_REPO_PATH: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
