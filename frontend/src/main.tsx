import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppThemeProvider } from './ThemeContext';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppThemeProvider>

  </React.StrictMode>
);
