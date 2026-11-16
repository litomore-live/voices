import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const source = fileURLToPath(new URL('../native/voices.swift', import.meta.url));
export async function ensureHelper() {
  if (process.platform !== 'darwin') throw new Error('The Siri voice helper requires macOS');
  await access(source);
  // On this Mac, compiled executables receive a filtered Siri voice list.
  // Run the source through Apple's Swift interpreter to retain those voices.
  return {command: '/usr/bin/xcrun', args: ['swift', '-suppress-warnings', source]};
}
