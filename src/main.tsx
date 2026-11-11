import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fonts are bundled with the site (no font service). Each file is split by
// script, and a browser only fetches the subsets a page actually uses.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource-variable/caveat/wght.css';

import './styles/base.css';
import './styles/components.css';
import './styles/landing.css';
import './styles/studio.css';
import './styles/letter.css';

import { App } from './App';
import { I18nProvider } from './i18n/I18nProvider';
import { MotionProvider } from './lib/motion';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <I18nProvider>
        <MotionProvider>
          <App />
        </MotionProvider>
      </I18nProvider>
    </StrictMode>,
  );
}
