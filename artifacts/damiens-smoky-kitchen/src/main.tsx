import { ClerkProvider } from '@clerk/react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY. Configure the public Clerk publishable key before building.');
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ClerkProvider publishableKey={clerkPublishableKey}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ClerkProvider>,
);
