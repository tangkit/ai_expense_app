import React from "react";
import { ExpenseProvider } from "./context/ExpenseContext";
import { ChatInterface, Sidebar } from "./components";
import "./App.css";

function App() {
  return (
    <ExpenseProvider>
      <div className="app">
        <header className="app-header">
          <div className="logo">
            <span className="logo-icon"></span>
            <h1>TANG's EXPENSE CLAIM AGENT</h1>
          </div>
          <h2>Intelligent Expense Filing for Your Business Trips</h2>
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
          <h2>Upload Receipts • Auto-File • Export</h2>
        </footer>
      </div>
    </ExpenseProvider>
  );
}

export default App;
