// Bundles the WebView UI (web/src) into assets/app.js, which the Vega
// package ships next to assets/index.html.
//
//   node web/build.mjs          one-off build (minified)
//   node web/build.mjs --watch  rebuild on change
import * as esbuild from 'esbuild';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  absWorkingDir: root,
  entryPoints: ['web/src/main.ts'],
  outfile: 'assets/app.js',
  bundle: true,
  format: 'iife',
  // The Vega WebView is Chromium-based; es2018 keeps a safe margin
  target: 'es2018',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
