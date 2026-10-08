import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@/styles/index.css';
import { router } from '@/app/router';

// Crochets de test : absents des builds de production (VITE_E2E non défini).
if (import.meta.env.VITE_E2E === '1') {
  void import('@/app/e2eHooks').then((m) => m.installE2EHooks());
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
