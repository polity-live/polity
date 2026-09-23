import { build } from 'vite';
import path from 'node:path';

let pending: Promise<string> | undefined;

export function studioV5RenderBundle() {
  return (pending ??= (async () => {
    const built = await build({
      configFile: false,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        write: false,
        minify: true,
        lib: {
          entry: path.resolve('tools/studio/studio-v5-render-entry.ts'),
          name: 'PolityStudioV5Renderer',
          formats: ['iife'],
        },
      },
    });
    const outputs = Array.isArray(built) ? built : [built];
    const chunks = outputs
      .flatMap(output => ('output' in output ? output.output : []))
      .filter(output => output.type === 'chunk');
    if (chunks.length !== 1) throw new Error('Unexpected Studio renderer bundle');
    return chunks[0].code;
  })());
}
