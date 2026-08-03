/**
 * withScreenErrorBoundary.tsx
 *
 * HOC that wraps a screen component in a per-screen ErrorBoundary.
 * One screen crash will not bring down the full app.
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

export function withScreenErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string,
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <ErrorBoundary screenName={screenName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withScreenErrorBoundary(${screenName})`;
  return Wrapped;
}
