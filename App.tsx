// SuperDesk Mobile - Main App
import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Navigation from './src/navigation/Navigation';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Require cycle:',
  'new NativeEventEmitter',
]);

const AppContent: React.FC = () => {
  const { theme, colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <Navigation />
    </GestureHandlerRootView>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // App initialization logic
    console.log('🚀 SuperDesk Mobile started');
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
