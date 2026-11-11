import { useId, type CSSProperties, type ReactNode } from 'react';
import { PALETTES } from '../engine/palettes';
import type { Dictionary } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import { MOODS, VOICES, type Mood, type Voice } from '../letter/model';
import { paletteVars } from './paletteVars';

export function paletteName(t: Dictionary, id: string): string {
  return (t.palettes as Record<string, string>)[id] ?? id;
}

/** One small emblem per atmosphere, drawn in the spirit of an engraved postage stamp. */
const MOTIFS: Record<Mood, ReactNode> = {
  calm: (
    <>
      <circle cx="31" cy="15" r="6" fill="currentColor" stroke="none" />
      <path d="M5 33c6.5-4 9.5 4 19 0s12.5 4 19 0" />
      <path d="M5 42c6.5-4 9.5 4 19 0s12.5 4 19 0" opacity=".65" />
      <path d="M5 51c6.5-4 9.5 4 19 0s12.5 4 19 0" opacity=".38" />
    </>
  ),
  celebration: (
    <>
      <path d="M24 26V10M24 26l11-11M24 26h15M24 26l10 10M24 26v15M24 26L14 36M24 26H9M24 26L13 15" />
      <circle cx="8" cy="48" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="38" cy="50" r="1.6" fill="currentColor" stroke="none" />
      <path d="M17 50l3 3M30 46l-2 4" opacity=".7" />
    </>
  ),
  longing: (
    <>
      <circle cx="10" cy="15" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="38" cy="43" r="3.2" fill="currentColor" stroke="none" />
      <path d="M10 15c-2 26 12 34 28 28" strokeDasharray="1 4.2" />
      <path d="M34 11v4M32 13h4M20 50v3M18.5 51.5h3" opacity=".7" />
    </>
  ),
  hope: (
    <>
      <path d="M8 56a16 16 0 0 1 32 0" fill="currentColor" stroke="none" opacity=".9" />
      <path d="M24 33V22M11 39l-6-7M37 39l6-7M5 51H1M47 51h-4" opacity=".75" />
      <path d="M24 22c0-7 5-11 10-12M24 17c0-5-4-8-8-9" />
    </>
  ),
};

interface ChoiceProps<T> {
  value: T;
  onChange: (value: T) => void;
}

/** Atmosphere, chosen like a stamp for the envelope. */
export function MoodPicker({ value, onChange, palette }: ChoiceProps<Mood> & { palette: number }) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset className="field">
      <legend className="field__label">{t.studio.atmosphere}</legend>
      <div className="stamps">
        {MOODS.map((mood) => (
          <label key={mood} className="stamp" style={paletteVars(mood, mood === value ? palette : 0)}>
            <input type="radio" className="visually-hidden" name={name} checked={mood === value} onChange={() => onChange(mood)} />
            <span className="stamp__card">
              <span className="stamp__face">
                <span className="stamp__paper">
                  <svg viewBox="0 0 48 60" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {MOTIFS[mood]}
                  </svg>
                </span>
              </span>
              <span className="stamp__name">{t.moods[mood].name}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="field__hint">{t.moods[value].line}</p>
    </fieldset>
  );
}

export function PalettePicker({ value, onChange, mood }: ChoiceProps<number> & { mood: Mood }) {
  const { t } = useI18n();
  const name = useId();
  const palettes = PALETTES[mood];
  return (
    <fieldset className="field">
      <legend className="field__label">
        {t.studio.colours}
        <span className="field__value">{paletteName(t, palettes[value]?.id ?? '')}</span>
      </legend>
      <div className="swatches">
        {palettes.map((palette, index) => (
          <label key={palette.id} className="swatch" title={paletteName(t, palette.id)}>
            <input type="radio" className="visually-hidden" name={name} checked={index === value} onChange={() => onChange(index)} />
            <span
              className="swatch__dot"
              style={{
                background: `conic-gradient(from 200deg, ${palette.sky[1]} 0 36%, ${palette.haze[0]} 36% 68%, ${palette.lights[0]} 68% 100%)`,
              }}
            />
            <span className="visually-hidden">{paletteName(t, palette.id)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function VoicePicker({ value, onChange }: ChoiceProps<Voice>) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset className="field">
      <legend className="field__label">{t.studio.lettering}</legend>
      <div className="voices">
        {VOICES.map((voice) => (
          <label key={voice} className="voice" data-voice={voice}>
            <input type="radio" className="visually-hidden" name={name} checked={voice === value} onChange={() => onChange(voice)} />
            <span className="voice__card">
              <span className="voice__sample" aria-hidden="true">
                Aa
              </span>
              <span className="voice__name">{t.voices[voice]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface SliderProps {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (value: number) => void;
}

export function Slider({ label, low, high, value, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="field slider">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="slider__input"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--fill': `${value}%` } as CSSProperties}
      />
      <div className="slider__ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
