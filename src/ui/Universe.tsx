import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { grainDataUrl } from '../engine/grain';
import { SceneRunner } from '../engine/runner';
import type { SceneConfig } from '../engine/types';
import { useI18n } from '../i18n/I18nProvider';
import { useMotion } from '../lib/motion';
import { paletteVars } from './paletteVars';

interface UniverseProps extends SceneConfig {
  /** React to pointer and touch. Events are read from the nearest `[data-stage]` ancestor. */
  interactive?: boolean;
  paused?: boolean;
  className?: string;
}

/**
 * The living scene. Purely decorative as far as assistive technology is
 * concerned: the words always live in the DOM, never in these pixels.
 *
 * Underneath the canvas sits a still gradient in the same palette. It is what
 * shows for the first frame, and what remains if the canvas cannot be used.
 */
export function Universe({ mood, palette, intensity, motion, seed, interactive = true, paused = false, className }: UniverseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<SceneRunner | null>(null);
  const [failed, setFailed] = useState(false);
  const [grain] = useState(grainDataUrl);
  const { still } = useMotion();
  const { t } = useI18n();
  const config = useMemo<SceneConfig>(() => ({ mood, palette, intensity, motion, seed }), [mood, palette, intensity, motion, seed]);

  const start = useEffectEvent((canvas: HTMLCanvasElement): SceneRunner | null => {
    const onFail = () => setFailed(true);
    try {
      return new SceneRunner(canvas, config, {
        still,
        interactive,
        pointerTarget: canvas.closest<HTMLElement>('[data-stage]'),
        onFail,
      });
    } catch (error) {
      console.warn('[living-letter] canvas unavailable, using the static fallback.', error);
      queueMicrotask(onFail);
      return null;
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runner = start(canvas);
    runnerRef.current = runner;
    return () => {
      runner?.destroy();
      runnerRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    runnerRef.current?.setConfig(config);
  }, [config]);

  useEffect(() => {
    runnerRef.current?.setStill(still);
  }, [still]);

  useEffect(() => {
    runnerRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <div className={`universe${className ? ` ${className}` : ''}`} style={paletteVars(mood, palette)}>
      {!failed && <canvas ref={canvasRef} className="universe__canvas" aria-hidden="true" />}
      <div className="universe__grain" aria-hidden="true" style={grain ? { backgroundImage: `url(${grain})` } : undefined} />
      {failed && <p className="universe__note">{t.common.fallbackNote}</p>}
    </div>
  );
}
