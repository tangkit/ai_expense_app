import React from 'react';
import { ExpenseProvider } from './context/ExpenseContext';
import { ChatInterface, Sidebar } from './components';
import './App.css';

function App() {
  return (
    <ExpenseProvider>
      <div className="app">
        <header className="app-header">
          <div className="logo">
            <span className="logo-icon">💼</span>
            <h1>Expense Claim Assistant</h1>
          </div>
          <p className="tagline">AI-powered receipt processing for your business trips</p>
        </header>

        <main className="app-main">
          <div className="chat-panel">
            <ChatInterface />
          </div>
          <div className="sidebar-panel">
            <Sidebar />
          </div>
        </main>

        <footer className="app-footer">
          <p>Upload receipts • Auto-extract data • Export to spreadsheet</p>
        </footer>
      </div>
    </ExpenseProvider>
  );
}

export default App;
