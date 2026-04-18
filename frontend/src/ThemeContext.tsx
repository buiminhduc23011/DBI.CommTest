import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);

export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  const toggleTheme = () => {
    setMode((prev) => {
      const newMode = prev === 'light' ? 'dark' : 'light';
      
      if (newMode === 'light') {
        document.body.classList.remove('dark-mode');
      } else {
        document.body.classList.add('dark-mode');
      }

      // Sync with Electron native window if applicable
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        (window as any).electronAPI.setTheme(newMode);
      }
      
      return newMode;
    });
  };

  // Sync mode on initial mount
  React.useEffect(() => {
    if (mode === 'dark') {
      document.body.classList.add('dark-mode');
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ConfigProvider
        theme={{
          algorithm: mode === 'light' ? antTheme.defaultAlgorithm : antTheme.darkAlgorithm,
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 4,
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};
