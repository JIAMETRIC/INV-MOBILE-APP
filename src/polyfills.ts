import { Buffer } from 'buffer';

const g = globalThis as unknown as { Buffer?: unknown; process?: unknown };

if (!g.Buffer) g.Buffer = Buffer;
if (!g.process) g.process = { env: {}, nextTick: (cb: () => void) => setTimeout(cb, 0) };
