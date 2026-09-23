import { build } from 'vite';
import path from 'node:path';
let pending: Promise<string> | undefined;
/** A browser-only SDK must be bundled for the isolated export browser. */
export function canvasRenderBundle() {
  return (pending ??= (async () => {
    const built = await build({
      configFile: false,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        write: false,
        minify: true,
        lib: {
          entry: path.resolve('tools/studio/canvas-render-entry.ts'),
          name: 'PolityCanvasRenderer',
          formats: ['iife'],
        },
      },
    });
    const outputs = Array.isArray(built) ? built : [built];
    const chunks = outputs
      .flatMap(o => ('output' in o ? o.output : []))
      .filter(o => o.type === 'chunk');
    if (chunks.length !== 1) throw new Error('Unexpected canvas renderer bundle');
    return chunks[0].code;
  })());
}
