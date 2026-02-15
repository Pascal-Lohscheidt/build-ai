import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'stream/index': 'src/stream/index.ts',
    'react/index': 'src/react/index.ts',
    'api/index': 'src/api/index.ts',
    'helper/index': 'src/helper/index.ts',
    'matrix/index': 'src/matrix/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: ['node18', 'es2020'],
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
    options.platform = 'neutral'; // Support both browser and node
    return options;
  },
  */
  // Ensure we process CSS
  loader: {
    '.css': 'css',
  },
});
