// ESLint 9 flat config, ported from nuxt-nr. Only the rules that apply to this repo are kept:
// the ignore list follows nr-editor's own build output, and nuxt-nr's server/api-only blocks
// (type-aware no-floating-promises, Capacitor/android/ios ignores) are not here.
//
// Type-aware linting is deliberately NOT on: it needs parserOptions.projectService, roughly
// triples the run time, and lint is not where type errors belong anyway. `npm run typecheck`
// (vue-tsc) and `npm run typecheck:ts` are the tools for those.
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import prettier from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default [
  {
    // Build output and vendored code. Mirrors .gitignore.
    ignores: [
      "**/*.d.ts",
      "node_modules/",
      ".nuxt/",
      ".output/",
      ".release/",
      ".diagcheck/",
      "dist/",
      "dist-electron/",
      "static/",
      "public/",
      // git submodule, shared with newrecruit.eu — it is linted there, with its own config.
      "assets/shared/",
      // rollup output of scripts/import/import_json.ts (see rollup.config.mjs).
      "scripts/import/import_json.js",
    ],
  },

  js.configs.recommended,
  ...vue.configs["flat/recommended"],

  {
    files: ["**/*.{js,mjs,cjs,ts,vue}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: { parser: tsParser },
    plugins: { "@typescript-eslint": tsPlugin, "unused-imports": unusedImports },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // The TS compiler already reports these, and it does it better (declaration merging,
      // ambient types, auto-imports). Leaving them on doubles up every message.
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      // Unlike no-unused-vars this autofixes; not enabled for .vue files, where template-only
      // type casts look unused to it (vue-tsc owns unused detection there).
      "unused-imports/no-unused-imports": "error",
      // Empty marker interfaces over a single supertype are intentional extension points here.
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
    },
  },

  {
    // Editor scripts run inside the page against globals injected by pages/catalogue.vue and
    // editorStore. The list mirrors types/global.d.ts, which eslint does not read — this is the
    // only place no-undef needs help, since it is off for .ts/.vue where tsc reports it better.
    files: ["default-scripts/**", "scripts/**"],
    languageOptions: {
      globals: {
        $catalogue: "readonly",
        $store: "readonly",
        $node: "readonly",
        $helpers: "readonly",
        $set: "readonly",
        $delete: "readonly",
        $toRaw: "readonly",
        $markRaw: "readonly",
        $nextTick: "readonly",
        notify: "readonly",
        customPrompt: "readonly",
        isEditor: "readonly",
      },
    },
  },

  {
    // Electron main-process code is CommonJS-land; require() is the native idiom there.
    files: ["electron/**"],
    languageOptions: { globals: globals.node },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },

  // Must come after everything that could enable a formatting rule: turns them all off so
  // prettier stays the only thing with an opinion about layout.
  prettier,

  {
    // Flat config resolves a plugin rule only against a plugin declared in the SAME object, so
    // both have to be repeated here even though the blocks above already load them.
    plugins: { "@typescript-eslint": tsPlugin, vue, "unused-imports": unusedImports },
    rules: {
      "vue/prop-name-casing": "off",
      "vue/no-v-html": "off",
      // no-v-for-template-key-on-child stays ON: key-on-child under <template v-for> is a Vue 3
      // compile error, and lint is the only thing that catches it before vite does.
      "vue/require-v-for-key": "off",

      // Layout and naming conventions, not defects. Prettier owns formatting and these fire
      // thousands of times on existing code, which is how a lint run stops being read at all.
      "vue/attributes-order": "off",
      "vue/order-in-components": "off",
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",
      "vue/require-explicit-emits": "off",
      "vue/attribute-hyphenation": "off",
      "vue/v-on-event-hyphenation": "off",
      "vue/no-template-shadow": "off",
      // Formatting rule that survives eslint-config-prettier; its autofix mangles indentation.
      "vue/first-attribute-linebreak": "off",
      // Menu/Label/Frame/Section are established component names; SFC PascalCase resolution
      // never confuses them with the native elements.
      "vue/no-reserved-component-names": "off",

      // Worth seeing, too widespread to block on today.
      "@typescript-eslint/no-explicit-any": "warn",
      // destructuredArrayIgnorePattern: `const [min, max] = getMinMax(x)` with max unused is not a
      // defect, and the position has to stay.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: ".", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-unused-expressions": "off",
      "prefer-const": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      // 42 existing hits. A `let` in an unbraced `case` leaks to the sibling cases, so this is a
      // real shape, but it has no autofix — warn until the backlog is worked down.
      "no-case-declarations": "warn",

      // Bug shapes, not style. Not in eslint:recommended, which is why they were missing.
      // Two are deliberately absent: `no-unreachable-loop` (the `for (...) { ...; break }`
      // first-match idiom in the bs engine trips it) and `no-constructor-return` (returning an
      // object from a constructor is how bs_main/optionv2 rehydrate JSON without copying, and tsc
      // already rejects every genuinely wrong constructor return via TS2409).
      "array-callback-return": "error",
      "no-unmodified-loop-condition": "error",
      "default-case-last": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-return-assign": "error",
      "prefer-spread": "error",
      "no-loss-of-precision": "error",

      // Autofixable cleanups. object-shorthand is deliberately "methods" only: the property form
      // (`{ name: name }` -> `{ name }`) couples the key to the variable name, so a textual rename
      // silently renames a field that may be serialized.
      "object-shorthand": ["error", "methods"],
      "no-var": "error",
      // `boolean: false` on purpose: the autofix rewrites `!!x` to `Boolean(x)`, which is
      // runtime-identical but does NOT narrow in TypeScript, so `!!x && x.foo` stops compiling.
      "no-implicit-coercion": ["error", { boolean: false }],
      "no-duplicate-imports": "warn",
      "vue/no-mutating-props": "off",
      "vue/no-unused-components": "warn",
      // Members used from outside the component (parent via $refs, mixin contract) look unused to
      // this rule; tag those /** @public */ instead of disabling.
      // 54 existing hits, mostly in components predating the left/right-panel split. Warn, not
      // error, until that is cleared; nuxt-nr runs the same rule at "error".
      "vue/no-unused-properties": ["warn", { groups: ["computed", "methods"], ignorePublicMembers: true }],

      // Deliberately silent catches are a documented pattern here; an empty catch with a comment
      // is intent, not an oversight.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
