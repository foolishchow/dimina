/**
 * @file Shared JSDoc types for bundler-session design probes — DRAFT only.
 *
 * Action: fe-tools-bundler-session
 * Used by: config.draft.mjs, resolve.draft.mjs, orchestrator.draft.mjs
 */

/**
 * @typedef {object} DiminaBundlerConfigDraft
 * @property {string} [root]
 * @property {string} [outDir]  build default out; NOT used for dev targetPath (D-R1); API: use targetPath on dev (D-R4)
 * @property {boolean} [useAppIdDir]
 * @property {DiminaBundlerCompileDraft} [compile]
 * @property {DiminaBundlerFileTypesDraft} [fileTypes]
 * @property {DiminaBundlerPluginDraft[]} [plugins]  OPEN
 * @property {DiminaBundlerServerFileDraft} [server]
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
 * @typedef {object} DiminaBundlerPluginDraft
 * @property {string} name
 * @property {(api: { on: (event: string, listener: Function) => void }) => void} apply
 */

/**
 * On-disk `server` block (config file).
 * `outDir` here is ONLY a hint for resolve → targetPath on command:'dev'.
 * It does NOT appear on ResolvedBundlerInput.server (host/port only).
 *
 * @typedef {object} DiminaBundlerServerFileDraft
 * @property {string} [host]
 * @property {number} [port]
 * @property {string} [outDir]  optional explicit dev output root → Resolved.targetPath
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
 * @typedef {object} ResolveBundlerConfigInput
 * @property {BundlerCommand} command
 * @property {object} [cli]  argv: prefer workPath/targetPath/useAppIdDir/host/port/compile flags
 * @property {object} [api]
 * @property {false|string|null} [configFile]  false=skip; string=path; null/undef=default discovery TBD
 * @property {DiminaBundlerConfigDraft} [fileConfig]  preloaded file object
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
