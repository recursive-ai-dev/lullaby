import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import ErrorMonitor from './errorMonitor.js';

ErrorMonitor.init();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
