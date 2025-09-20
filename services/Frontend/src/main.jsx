import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx'; // Import ThemeProvider

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider> {/* Wrap App with ThemeProvider */}
        <App />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
