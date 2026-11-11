import type { ReactNode } from 'react';

/** Small stroke icons drawn inline — decorative, always paired with a text label. */
function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const ArrowIcon = () => (
  <Icon>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const BackIcon = () => (
  <Icon>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);
export const PauseIcon = () => (
  <Icon>
    <path d="M9 6v12M15 6v12" />
  </Icon>
);
export const PlayIcon = () => (
  <Icon>
    <path d="M8 5.5v13l10-6.5z" />
  </Icon>
);
export const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
);
export const CheckIcon = () => (
  <Icon>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const ShareIcon = () => (
  <Icon>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Icon>
);
export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11M8 11l4 4 4-4M5 19h14" />
  </Icon>
);
export const EyeIcon = () => (
  <Icon>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icon>
);
export const SparkIcon = () => (
  <Icon>
    <path d="M12 3.5l1.7 5.1 5.1 1.7-5.1 1.7L12 17.1l-1.7-5.1-5.1-1.7 5.1-1.7zM18.5 16v4M16.5 18h4" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const SendIcon = () => (
  <Icon>
    <path d="M20.5 3.5L10 14M20.5 3.5l-6.5 17-4-6.5-6.5-4z" />
  </Icon>
);

/** The mark: a point of light and the orbit it has gathered. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <ellipse cx="16" cy="16" rx="13" ry="5.4" transform="rotate(-24 16 16)" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
      <circle cx="27.4" cy="10.6" r="1.5" fill="currentColor" />
    </svg>
  );
}
