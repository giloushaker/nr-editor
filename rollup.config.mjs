import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: './scripts/import_json.ts', // Entry point of your script
  watch: true,
  output: {
    file: './scripts/import_json.js', // Output bundle file
    format: 'umd', // Output format (iife for browser, cjs for Node, etc.)
  },
  plugins: [
    nodeResolve(), // Resolves node modules
    commonjs(), // Converts CommonJS modules to ES6
    typescript({ tsconfig: '.nuxt/tsconfig.json' }), // Compiles TypeScript
  ],
};