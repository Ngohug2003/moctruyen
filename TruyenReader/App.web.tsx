import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as db from './src/data/library';
import { MotionProvider } from './src/ui/motion';
import { LibraryScreen } from './src/features/library/LibraryScreen';
import { ErrorBoundary, Loading } from './src/ui/primitives';

export default function App() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    db.initializeWeb()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Web init error:', err);
        setReady(true);
      });
  }, []);
  if (!ready) return <Loading />;
  return (
    <SafeAreaProvider>
      <MotionProvider>
        <ErrorBoundary>
          <LibraryScreen />
        </ErrorBoundary>
      </MotionProvider>
    </SafeAreaProvider>
  );
}
