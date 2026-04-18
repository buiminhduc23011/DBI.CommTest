import React, { createContext, useContext, ReactNode } from 'react';
import { useHomeState, HomeState } from './hooks/useHomeState';

const HomeContext = createContext<HomeState | null>(null);

function useHomeContextValue() {
  const context = useContext(HomeContext);
  if (!context) {
    throw new Error('useHomeContext must be used within a HomeProvider');
  }
  return context;
}

export { useHomeContextValue as useHomeContext };

export const HomeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const state = useHomeState();

  return (
    <HomeContext.Provider value={state}>
      {state.contextHolder}
      {children}
    </HomeContext.Provider>
  );
};
