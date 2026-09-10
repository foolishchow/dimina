/**
 * @file Dimina bundler — **DRAFT** project config (design probe only)
 *
 * Action: fe-tools-bundler-session
 * Status: NOT frozen as product · NOT loaded by runtime · NOT an implementation commitment
 *
 * Purpose:
 * - Force fields / layering into the open for discussion
 * - Map mentally to a future `resolveBundlerConfig()` → createBundler(resolved)
 *
 * Non-goals of this file:
 * - Final filename / package exports
 * - Replacing mini-program app.json
 * - Rewriting CF-1 `resolveCompileConfig` semantics
 *
 * Priority — ACCEPTED (discussion 2026-09-10), P1–P6:
 *   CLI argv > API explicit options > config file > built-in defaults / mode presets
 *
 *   P1  Same total order for compile keys (C1) and later scalar-like options
 *   P2  dimina-cli: argv → cli layer; loaded file → file layer; usually no extra api layer
 *   P3  Pure API: createBundler/build options → apiOptions; may still load file from root as base
 *   P4  Escape hatch (names TBD): configFile: false | configFile: '<path>' — at least “skip file”
 *   P5  Top-level fileTypes: same order; today no CLI flag → API > file > built-in
 *   P6  Future plugins/server use the same total order (no parallel scheme)
 *
 * Implementation sketch: treat file as a layer under api, then reuse today’s
 *   resolveCompileConfig({ cli, apiOptions })  (cli > api > presets/defaults)
 *
 * --- Accepted field decisions (discussion 2026-09-10) ---
 *
 * Paths: root / outDir / useAppIdDir
 * Priority: P1–P6
 * Compile: C1–C7; fileTypes top-level C6
 * Server: Sv1–Sv6; resolve D-R1 (dev ignores file.outDir), D-R3 (Resolved.server host/port only)
 * Plugins: STILL OPEN
 *
 * Resolve decisions (2026-09-10):
 *   D-R1  dev targetPath ← cli/api targetPath | file.server.outDir | temp — NOT file.outDir
 *   D-R2  command:'dev' seeds mode+platform; after merge MUST stay mode:'dev'+platform:'web'
 *         else hard-fail (strategy C); other C1 keys still overridable; session uses as-is
 *   D-R3  Resolved.server = { host, port } only
 *   D-R4  dev targetPath omits api.outDir — API uses api.targetPath (不加)
 *
 * Compile (C1–C7):
 *   C1  Allowed keys in `compile`: mode | platform | minify | sourcemap | esTarget
 *       Unknown keys → hard fail (CF-1 strict style)
 *       Do NOT put sourcemapStrategy in the file (derived from platform)
 *   C2  minify omitted → mode preset (build=true, dev=false); explicit bool overrides;
 *       CLI --minify / --no-minify overrides file
 *   C3  sourcemap omitted → false; CLI --sourcemap overrides file
 *   C4  esTarget omitted → CF-1 defaults { logic: es2023, view: es2020 };
 *       partial object allowed (missing side filled with default);
 *       no CLI flag today → file is top file-layer input for esTarget
 *   C5  mode/platform omitted → command seeds (build→build+native, dev→dev+web);
 *       build: file/api/cli may change seeds; dev: post-merge drift from mode:'dev'/
 *       platform:'web' → hard-fail (D-R2/C); other C1 keys still free; session no re-force;
 *       CLI --platform (build) / future --mode override file when present
 *   C6  fileTypes is TOP-LEVEL (optional), NOT under compile — pipeline option,
 *       same append semantics as build()/storeInfo(); omit → built-in wx/dd only
 *   C7  For C1 keys: CLI > API > file.compile > defaults/presets (see P1), then feed
 *       existing resolveCompileConfig (or equivalent) — no second minify/esTarget model
 *
 * Suggested evolution:
 *   S_config_draft (this) → freeze Resolved shape → session eats Resolved →
 *   optional loader that reads a real config file
 */

/** @type {import('./config.draft.types.js').DiminaBundlerConfigDraft} */
export default {
	// --- session paths — ACCEPTED ---
	/** Mini-program project root (app.json). Today: CLI `-c` / workPath */
	root: '.',
	/** Compile output root. Today: CLI `-s` / targetPath */
	outDir: '.',
	/** Whether published tree includes appId segment. Today: `--no-app-id-dir` flips this */
	useAppIdDir: true,

	/**
	 * Compile profile — ACCEPTED (C1–C5, C7).
	 * Only keys listed in C1; merges into resolveCompileConfig.
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
	 * Custom file extensions — ACCEPTED (C6): top-level, optional.
	 * Append-only on top of built-in wx/dd types. Omit → defaults only.
	 * Not part of resolveCompileConfig / compile profile.
	 */
	// fileTypes: {
	//   template: ['qdml'],
	//   style: ['qdss'],
	//   viewScript: ['qds'],
	// },

	/**
 * L0 / pipeline plugins — OPEN / not this Action’s primary delivery.
 * Do not treat shape below as accepted. See stages.draft.md for builtin inventory.
 */
	// plugins: [ /* TBD: inline vs module path; L0 apply only when session exists */ ],

	/**
	 * Dev / preview — ACCEPTED minimal shape (Sv1–Sv6 + resolve D-R1/D-R3).
	 * Resolved.server = host/port only. Optional file `server.outDir` feeds
	 * Resolved.targetPath on command:'dev' (NOT top-level outDir — D-R1).
	 * Consumed only by dimina-cli dev / bundler.dev; build ignores this block.
	 */
	// server: {
	//   host: '127.0.0.1',
	//   port: 8080,
	//   // outDir: '...'  // optional → resolve targetPath for dev only
	// },
}
