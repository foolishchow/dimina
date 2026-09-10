/**
 * @file Shared JSDoc types for bundler-session design probes — DRAFT only.
 *
 * Action: fe-tools-bundler-session
 * Used by: config.draft.mjs, resolve.draft.mjs, orchestrator.draft.mjs
 *
 * Scope note (2026-09-10): NO file/config-file layer this Action. The `api` layer
 * describes programmatic options to resolveBundlerConfig, NOT an on-disk schema.
 */

/**
 * `api` layer (programmatic options). NOT an on-disk config file schema this Action.
 * @typedef {object} DiminaBundlerApiLayerDraft
 * @property {string} [root]
 * @property {string} [outDir]  build default out; NOT used for dev targetPath (D-R4); API: use targetPath on dev
 * @property {boolean} [useAppIdDir]
 * @property {DiminaBundlerCompileDraft} [compile]
 * @property {DiminaBundlerFileTypesDraft} [fileTypes]
 * @property {DiminaBundlerPluginDraft[]} [plugins]  RESERVED — not loaded this Action
 * @property {DiminaBundlerServerApiDraft} [server]
 */

/**
 * C1 allowed keys only.
 * @typedef {object} DiminaBundlerCompileDraft
 * @property {'build'|'dev'} [mode]
 * @property {'native'|'web'} [platform]
 * @property {boolean} [minify]
 * @property {boolean} [sourcemap]
 * @property {{ logic?: string, view?: string }} [esTarget]
 */

/**
 * @typedef {object} DiminaBundlerFileTypesDraft
 * @property {string[]} [template]
 * @property {string[]} [style]
 * @property {string[]} [viewScript]
 */

/**
 * Plugin shape — RESERVED, not loaded this Action. `createBundler` does not expose `use()`;
 * `api.plugins` accepted syntactically but not applied. Plugin API = separate Action.
 *
 * @typedef {object} DiminaBundlerPluginDraft
 * @property {string} name
 * @property {(api: { on: (event: string, listener: Function) => void }) => void} apply
 */

/**
 * `server` block on the api layer. host/port feed Resolved.server; no outDir
 * (dev targetPath comes from api.targetPath or temp, NOT server.outDir — D-R1/D-R4).
 *
 * @typedef {object} DiminaBundlerServerApiDraft
 * @property {string} [host]
 * @property {number} [port]
 */

/**
 * Runtime server on Resolved / session — host/port only.
 * @typedef {object} DiminaBundlerServerResolved
 * @property {string} [host]
 * @property {number} [port]
 */

/**
 * @typedef {'build'|'dev'} BundlerCommand
 */

/**
 * Input of resolveBundlerConfig. Two layers only this Action: cli + api.
 * NO configFile / fileConfig (file layer deferred — see requirements.md Non-requirements).
 *
 * @typedef {object} ResolveBundlerConfigInput
 * @property {BundlerCommand} command
 * @property {object} [cli]  argv: prefer workPath/targetPath/useAppIdDir/host/port/compile flags
 * @property {DiminaBundlerApiLayerDraft} [api]  explicit programmatic options
 */

/**
 * Output of resolveBundlerConfig → input of createBundler.
 * Single authoritative shape for probes.
 *
 * @typedef {object} ResolvedBundlerInput
 * @property {string} workPath
 * @property {string} targetPath
 * @property {boolean} useAppIdDir
 * @property {DiminaBundlerCompileDraft} compile
 * @property {DiminaBundlerFileTypesDraft} [fileTypes]
 * @property {DiminaBundlerServerResolved} [server]  host/port only; omit for build
 * @property {BundlerCommand} command
 * @property {object} [lifecycle]  test inject only; createBundler may add if missing
 */

export {}
