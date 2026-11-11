/**
 * Test double for the 2D canvas, so the engine can run under Node.
 *
 * Nothing is drawn. Instead every call and every property assignment is folded
 * into a running hash, which turns "did these two runs draw the same picture?"
 * into a comparison of two numbers.
 */
export interface DrawLog {
  /** Number of drawing operations seen. */
  count: number;
  /** Order-sensitive digest of every operation and its arguments. */
  hash: number;
  reset(): void;
}

export function installFakeCanvas(): DrawLog {
  const log: DrawLog = {
    count: 0,
    hash: 0x811c9dc5,
    reset() {
      this.count = 0;
      this.hash = 0x811c9dc5;
    },
  };

  const mix = (value: number) => {
    log.hash = Math.imul(log.hash ^ (value | 0), 0x01000193) >>> 0;
  };
  const record = (name: string, args: readonly unknown[]) => {
    log.count++;
    for (let i = 0; i < name.length; i++) mix(name.charCodeAt(i));
    for (const arg of args) {
      // Coordinates are rounded to a hundredth of a pixel: enough to catch real
      // differences, coarse enough to ignore floating-point dust.
      if (typeof arg === 'number') mix(Math.round(arg * 100));
      else if (typeof arg === 'string') for (let i = 0; i < arg.length; i++) mix(arg.charCodeAt(i));
    }
  };

  const createContext = () => {
    const state: Record<string, unknown> = {};
    return new Proxy(state, {
      get(target, property) {
        const name = String(property);
        if (name in target) return target[name];
        if (name === 'createLinearGradient' || name === 'createRadialGradient') {
          return (...args: unknown[]) => {
            record(name, args);
            return { addColorStop: (...stop: unknown[]) => record('stop', stop) };
          };
        }
        if (name === 'createImageData') {
          return (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
        }
        if (name === 'createPattern') return () => ({});
        if (name === 'measureText') return (text: string) => ({ width: text.length * 10 });
        return (...args: unknown[]) => record(name, args);
      },
      set(target, property, value) {
        const name = String(property);
        target[name] = value;
        record(`=${name}`, [typeof value === 'object' ? 0 : value]);
        return true;
      },
    });
  };

  const createCanvas = () => {
    const context = createContext();
    return { width: 0, height: 0, style: {}, getContext: () => context, toDataURL: () => 'data:,' };
  };

  (globalThis as { document?: unknown }).document = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`fake document cannot create <${tag}>`);
      return createCanvas();
    },
  };
  return log;
}
