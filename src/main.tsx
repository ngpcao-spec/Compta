import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { vi } from '@/i18n/vi';

function Placeholder() {
  return <main className="p-4 font-semibold">{vi.appName}</main>;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);
