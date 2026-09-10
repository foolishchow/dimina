/**
 * @file Dimina bundler — **DRAFT** project config (design probe only)
 *
 * Action: fe-tools-bundler-session
 * Status: NOT frozen as product · NOT loaded by runtime · NOT an implementation commitment
 *
 * Purpose: document the field/layering design for `resolveBundlerConfig()` → createBundler(resolved).
 *
 * Non-goals of this file:
 * - Final filename / package exports
 * - Replacing mini-program app.json
 * - Rewriting CF-1 `resolveCompileConfig` semantics
 *
 * --- SCOPE DECISION (scope-boundary review, 2026-09-10) ---
 *
 * This Action resolves TWO layers only: cli (argv) + api (explicit programmatic options).
 * There is NO file/config-file layer this Action. Today's bundler has no tool-config file
 * layer — `project.config.json` is a mini-program project file read by `env.storeInfo`
 * (pipeline), not a bundler tool config. Introducing a file layer is a separate concern and
 * out of scope for a session/facade Action. See requirements.md Non-requirements.
 *
 * The field shapes below describe the `api` layer (programmatic options to
 * `resolveBundlerConfig({ command, cli, api })`) and the resulting `ResolvedBundlerInput`.
 * They are NOT an on-disk config file schema. A future config-loader Action may reintroduce
 * a file layer that feeds the same `api` shape.
 *
 * Priority — ACCEPTED this Action (P1–P3; P4–P6 reserved for future file/plugin layers):
 *   P1  Same total order for compile keys (C1): CLI argv > API explicit > defaults/presets
 *   P2  dimina-cli: argv → cli layer; usually no api layer
 *   P3  Pure API: createBundler/build options → api layer
 *   P4–P6 reserved: file layer / plugins / server-file — NOT this Action
 *
 * Implementation sketch: reuse today’s resolveCompileConfig({ cli, apiOptions })
 * (cli > api > presets/defaults) — NO second C1 model (R-BC7 / C7).
 *
 * --- Accepted field decisions (discussion 2026-09-10) ---
 *
 * Paths: root / outDir / useAppIdDir (api layer)
 * Compile: C1–C7; fileTypes top-level C6
 * Server: Sv1–Sv6; D-R3 (Resolved.server host/port only)
 * Plugins: RESERVED (not loaded this Action)
 *
 * Resolve decisions (2026-09-10):
 *   D-R1  dev targetPath ← cli.targetPath | api.targetPath | temp — NOT api.outDir
 *   D-R2  command:'dev' seeds mode+platform; after merge MUST stay mode:'dev'+platform:'web'
 *         else hard-fail (strategy C); other C1 keys still overridable; session uses as-is
 *   D-R3  Resolved.server = { host, port } only
 *   D-R4  dev targetPath omits api.outDir — API uses api.targetPath (不加)
 *
 * Compile (C1–C7):
 *   C1  Allowed keys in `compile`: mode | platform | minify | sourcemap | esTarget
 *       Unknown keys → hard fail (CF-1 strict style)
 *       Do NOT put sourcemapStrategy in the api layer (derived from platform)
 *   C2  minify omitted → mode preset (build=true, dev=false); explicit bool overrides;
 *       CLI --minify / --no-minify overrides api
 *   C3  sourcemap omitted → false; CLI --sourcemap overrides api
 *   C4  esTarget omitted → CF-1 defaults { logic: es2023, view: es2020 };
 *       partial object allowed (missing side filled with default)
 *   C5  mode/platform omitted → command seeds (build→build+native, dev→dev+web);
 *       build: api/cli may change seeds; dev: post-merge drift from mode:'dev'/
 *       platform:'web' → hard-fail (D-R2/C); other C1 keys still free; session no re-force
 *   C6  fileTypes is TOP-LEVEL (optional), NOT under compile — pipeline option,
 *       same append semantics as build()/storeInfo(); omit → built-in wx/dd only
 *   C7  For C1 keys: CLI > API > defaults/presets (see P1), then feed existing
 *       resolveCompileConfig (or equivalent) — no second minify/esTarget model (R-BC7)
 *
 * Suggested evolution:
 *   S_config_draft (this) → freeze Resolved shape → session eats Resolved →
 *   (future Action) optional loader that reads a real config file → feeds api layer
 */

/**
 * `api` layer shape (programmatic options). NOT an on-disk file schema this Action.
 * @type {import('./config.draft.types.js').DiminaBundlerApiLayerDraft}
 */
export default {
	// --- session paths (api layer) ---
	/** Mini-program project root (app.json). Today: CLI `-c` / workPath */
	root: '.',
	/** Build output root. Today: CLI `-s` / targetPath. dev ignores this (D-R4) */
	outDir: '.',
	/** Whether published tree includes appId segment. Today: `--no-app-id-dir` flips this */
	useAppIdDir: true,

	/**
	 * Compile profile (C1–C5, C7). Only keys in C1; merges into resolveCompileConfig.
	 */
	compile: {
		/** @type {'build' | 'dev'} — omit → command seed; on command:'dev', final must stay 'dev' (D-R2/C) */
		mode: 'build',
		/** @type {'native' | 'web'} — omit → command seed; on command:'dev', final must stay 'web' (D-R2/C) */
		platform: 'native',
		// minify: true|false,     // C2: omit → mode preset; CLI --minify/--no-minify wins
		/** C3: omit → false; CLI --sourcemap wins */
		sourcemap: false,
		/** C4: omit whole object → CF-1 defaults; partial OK */
		esTarget: {
			logic: 'es2023',
			view: 'es2020',
		},
	},

	/**
	 * Custom file extensions (C6): top-level, optional.
	 * Append-only on top of built-in wx/dd types. Omit → defaults only.
	 * Not part of resolveCompileConfig / compile profile.
	 */
	// fileTypes: {
	//   template: ['qdml'],
	//   style: ['qdss'],
	//   viewScript: ['qds'],
	// },

	/**
	 * Plugins — RESERVED (not loaded this Action). `createBundler` does not expose `use()`.
	 * Plugin API = separate Action. See stages.draft.md for builtin inventory.
	 */
	// plugins: [ /* reserved — not loaded by resolveBundlerConfig this Action */ ],

	/**
	 * Dev / preview (Sv1–Sv6 + D-R3). Resolved.server = host/port only.
	 * Consumed only by dimina-cli dev / bundler.dev; build ignores this block.
	 */
	// server: {
	//   host: '127.0.0.1',
	//   port: 8080,
	// },
}
