import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { HomePage } from '@/features/home/HomePage';
import { TxFormPage } from '@/features/transactions/TxFormPage';
import { MorePage } from '@/features/more/MorePage';
import { RootLayout, TabLayout } from './layouts';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <TabLayout />,
            children: [
              { path: '/', element: <HomePage /> },
              // Recharts est lourd : chargé à la demande.
              {
                path: '/charts',
                lazy: async () => ({
                  Component: (await import('@/features/charts/ChartsPage')).ChartsPage,
                }),
              },
              { path: '/more', element: <MorePage /> },
            ],
          },
          {
            path: '/trend',
            lazy: async () => ({
              Component: (await import('@/features/trend/TrendPage')).TrendPage,
            }),
          },
          { path: '/tx/new', element: <TxFormPage /> },
          { path: '/tx/:id', element: <TxFormPage /> },
          {
            path: '/more/categories',
            lazy: async () => ({
              Component: (await import('@/features/categories/CategoriesPage')).CategoriesPage,
            }),
          },
          {
            path: '/more/categories/:id',
            lazy: async () => ({
              Component: (await import('@/features/categories/CategoryEditPage')).CategoryEditPage,
            }),
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
