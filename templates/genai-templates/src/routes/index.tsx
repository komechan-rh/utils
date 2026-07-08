import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/app/AppLayout';
import { AboutPage } from '@/pages/AboutPage';
import { HomePage } from '@/pages/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'about',
        element: <AboutPage />,
      },
    ],
  },
]);
