/**
 * Rollup configuration for optimal bundle size and tree-shaking
 * Optimizations:
 * - ES modules for tree-shaking
 * - Code splitting
 * - Minification
 * - External dependencies
 * - Separate CLI and SDK bundles
 */

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import { defineConfig } from 'rollup';

const production = !process.env.ROLLUP_WATCH;

// Shared external dependencies (not bundled)
const external = [
  'zod',
  'commander',
  'chalk',
  'ora',
  'midstreamer',
  'agentic-robotics',
  'ruvector',
  'path',
  'fs',
  'util',
  'stream',
  'events',
];

// Common plugins for all builds
const commonPlugins = [
  resolve({
    preferBuiltins: true,
    extensions: ['.ts', '.js', '.json'],
  }),
  commonjs(),
  json(),
  typescript({
    tsconfig: './tsconfig.json',
    sourceMap: !production,
    inlineSources: !production,
  }),
];

export default defineConfig([
  // SDK bundle (optimized for library usage)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: !production,
        exports: 'named',
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: !production,
      },
    ],
    external,
    plugins: [
      ...commonPlugins,
      production && terser({
        compress: {
          drop_console: false,
          drop_debugger: true,
          pure_funcs: ['console.debug'],
        },
        mangle: {
          keep_classnames: true,
          keep_fnames: true,
        },
        format: {
          comments: false,
        },
      }),
    ].filter(Boolean),
  },

  // CLI bundle (includes bin shebang)
  {
    input: 'src/cli.ts',
    output: {
      file: 'dist/cli.js',
      format: 'cjs',
      sourcemap: !production,
      banner: '#!/usr/bin/env node',
    },
    external,
    plugins: [
      ...commonPlugins,
      production && terser({
        compress: {
          drop_console: false,
          drop_debugger: true,
        },
        mangle: false, // Keep function names for CLI
        format: {
          comments: false,
        },
      }),
    ].filter(Boolean),
  },

  // Core modules with code splitting (for lazy loading)
  {
    input: {
      'core/cache': 'src/core/cache.ts',
      'core/genetic-optimizer': 'src/core/genetic-optimizer.ts',
      'core/stream-processor': 'src/core/stream-processor.ts',
      'core/model-router': 'src/core/model-router.ts',
    },
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: !production,
      chunkFileNames: 'chunks/[name]-[hash].js',
    },
    external,
    plugins: [
      ...commonPlugins,
      production && terser({
        compress: {
          drop_console: false,
          drop_debugger: true,
          module: true,
        },
      }),
    ].filter(Boolean),
    preserveEntrySignatures: 'strict',
  },
]);
