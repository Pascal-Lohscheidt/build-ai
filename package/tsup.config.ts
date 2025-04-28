import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'stream/index': 'src/stream/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  /**
   * SolidJS specific options - transform JSX to functions but in a way that's compatible
   * with external environments
  external: [
    'solid-js',
    'solid-js/web',
    'solid-js/jsx-runtime',
    'solid-js/store',
  ],

   
  esbuildOptions(options) {
    options.jsx = 'transform'; // Transform JSX to createElement calls
    options.jsxFactory = 'h';
    options.jsxImportSource = 'solid-js';
    options.platform = 'browser';
    return options;
  },
  */
  // Ensure we process CSS
  loader: {
    '.css': 'css',
  },
});
