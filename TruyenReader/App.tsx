import { SQLiteProvider } from 'expo-sqlite';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import meta from './assets/book-meta.json';
import * as db from './src/data/library';
import { MotionProvider } from './src/ui/motion';

import { LibraryScreen } from './src/features/library/LibraryScreen';
import { ErrorBoundary, Loading } from './src/ui/primitives';
export default function App() {
  return (
    <SafeAreaProvider>
      <MotionProvider>
        <ErrorBoundary>
          <React.Suspense fallback={<Loading />}>
            <SQLiteProvider
              databaseName={`seed-lite-${meta.hash}.db`}
              assetSource={{ assetId: require('./assets/catalog.db') }}
              onInit={db.initialize}
              useSuspense
            >
              <LibraryScreen />
            </SQLiteProvider>
          </React.Suspense>
        </ErrorBoundary>
      </MotionProvider>
    </SafeAreaProvider>
  );
}
