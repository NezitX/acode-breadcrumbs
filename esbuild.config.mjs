import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { sassPlugin } from 'esbuild-sass-plugin';

const isServe = process.argv.includes('--serve');

// Function to copy the WASM file
function saveWasm() {
  exec(
    'cp ./node_modules/web-tree-sitter/tree-sitter.wasm ./dist/tree-sitter.wasm',
    (err, stdout, stderr) => {
      if (err) {
        console.error('Error copying WASM file:', err);
        return;
      }
    }
  );
}

// Function to pack the ZIP file
function packZip() {
  exec('node .vscode/pack-zip.js', (err, stdout, stderr) => {
    if (err) {
      console.error('Error packing zip:', err);
      return;
    }
    console.log(stdout.trim());
  });
}

// Custom plugin to pack ZIP after build or rebuild
const zipPlugin = {
  name: 'zip-plugin',
  setup(build) {
    build.onEnd(() => {
      saveWasm();
      packZip();
    });
  }
};

// Base build configuration
let buildConfig = {
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  logLevel: 'info',
  color: true,
  outdir: 'dist',
  platform: 'browser',
  external: ['fs', 'path'],
  plugins: [
    zipPlugin,
    sassPlugin({
      type: 'css-text',
      async transform(source) {
        const svgRegex = /url\(['"]?([^'"\)]+\.svg)['"]?\)/g;
        let transformedSource = source;

        // Find all SVG URLs
        const matches = [...source.matchAll(svgRegex)];
        for (const match of matches) {
          const svgPath = match[1];
          const svgContent = await fs.promises.readFile(`src/${svgPath}`, 'utf8');
          const encodedSVG = encodeURIComponent(svgContent)
            .replace(/'/g, '%27')
            .replace(/"/g, '%22');
          const dataURL = `url('data:image/svg+xml;utf8,${encodedSVG}')`;
          transformedSource = transformedSource.replace(match[0], dataURL);
        }

        return transformedSource;
      },
    }),
    {
      name: 'empty-modules',
      setup(build) {
        // Handle fs module
        build.onResolve({ filter: /^fs$/ }, () => ({
          path: 'fs',
          namespace: 'empty-module'
        }));

        // Handle path module
        build.onResolve({ filter: /^path$/ }, () => ({
          path: 'path',
          namespace: 'empty-module'
        }));

        // Provide empty module implementation
        build.onLoad({ filter: /.*/, namespace: 'empty-module' }, () => ({
          contents: 'export default {};',
          loader: 'js'
        }));
      }
    }
  ]
};

// Main function to handle both serve and production builds
(async function () {
  if (isServe) {
    console.log('Starting development server...');

    // Watch and Serve Mode
    const ctx = await esbuild.context(buildConfig);

    await ctx.watch();
    const { host, port } = await ctx.serve({
      servedir: '.',
      port: 3000
    });
  } else {
    console.log('Building for production...');
    await esbuild.build(buildConfig);
    console.log('Production build complete.');
  }
})();
