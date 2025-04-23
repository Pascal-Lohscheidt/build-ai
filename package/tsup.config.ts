import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['solid-js', 'solid-js/web'],
  esbuildOptions(options) {
    options.jsx = 'preserve';
    options.jsxImportSource = 'solid-js';
  },
  // Ensure we process CSS
  loader: {
    '.css': 'css',
  },
});
