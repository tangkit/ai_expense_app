import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { EXPENSE_CATEGORIES, MEAL_COMPANION_THRESHOLD } from '../constants/expenseTypes';

// Initial state
const initialState = {
  expenses: [],
  currentExpense: null,
  messages: [],
  isProcessing: false,
  error: null,
  pendingUploads: [],
  reportSummary: null
};

// Action types
const ACTIONS = {
  ADD_EXPENSE: 'ADD_EXPENSE',
  UPDATE_EXPENSE: 'UPDATE_EXPENSE',
  REMOVE_EXPENSE: 'REMOVE_EXPENSE',
  SET_CURRENT_EXPENSE: 'SET_CURRENT_EXPENSE',
  CLEAR_CURRENT_EXPENSE: 'CLEAR_CURRENT_EXPENSE',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_PROCESSING: 'SET_PROCESSING',
  SET_ERROR: 'SET_ERROR',
  ADD_PENDING_UPLOAD: 'ADD_PENDING_UPLOAD',
  REMOVE_PENDING_UPLOAD: 'REMOVE_PENDING_UPLOAD',
  UPDATE_REPORT_SUMMARY: 'UPDATE_REPORT_SUMMARY',
  CLEAR_ALL_EXPENSES: 'CLEAR_ALL_EXPENSES'
};

// Reducer function
function expenseReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_EXPENSE:
      return {
        ...state,
        expenses: [...state.expenses, action.payload],
        currentExpense: null
      };

    case ACTIONS.UPDATE_EXPENSE:
      return {
        ...state,
        expenses: state.expenses.map(exp =>
          exp.id === action.payload.id ? { ...exp, ...action.payload } : exp
        )
      };

    case ACTIONS.REMOVE_EXPENSE:
      return {
        ...state,
        expenses: state.expenses.filter(exp => exp.id !== action.payload)
      };

    case ACTIONS.SET_CURRENT_EXPENSE:
      return {
        ...state,
        currentExpense: action.payload
      };

    case ACTIONS.CLEAR_CURRENT_EXPENSE:
      return {
        ...state,
        currentExpense: null
      };

    case ACTIONS.ADD_MESSAGE:
      return {
        ...state,
        messages: [...state.messages, {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          ...action.payload
        }]
      };

    case ACTIONS.SET_PROCESSING:
      return {
        ...state,
        isProcessing: action.payload
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload
      };

    case ACTIONS.ADD_PENDING_UPLOAD:
      return {
        ...state,
        pendingUploads: [...state.pendingUploads, action.payload]
      };

    case ACTIONS.REMOVE_PENDING_UPLOAD:
      return {
        ...state,
        pendingUploads: state.pendingUploads.filter(id => id !== action.payload)
      };

    case ACTIONS.UPDATE_REPORT_SUMMARY:
      return {
        ...state,
        reportSummary: action.payload
      };

    case ACTIONS.CLEAR_ALL_EXPENSES:
      return {
        ...state,
        expenses: [],
        currentExpense: null,
        reportSummary: null
      };

    default:
      return state;
  }
}

// Create context
const ExpenseContext = createContext(null);

// Provider component
export function ExpenseProvider({ children }) {
  const [state, dispatch] = useReducer(expenseReducer, initialState);

  // Action creators
  const addExpense = useCallback((expense) => {
    const expenseWithId = {
      ...expense,
      id: expense.id || uuidv4(),
      createdAt: new Date().toISOString()
    };
    dispatch({ type: ACTIONS.ADD_EXPENSE, payload: expenseWithId });
    return expenseWithId;
  }, []);

  const updateExpense = useCallback((id, updates) => {
    dispatch({ type: ACTIONS.UPDATE_EXPENSE, payload: { id, ...updates } });
  }, []);

  const removeExpense = useCallback((id) => {
    dispatch({ type: ACTIONS.REMOVE_EXPENSE, payload: id });
  }, []);

  const setCurrentExpense = useCallback((expense) => {
    dispatch({ type: ACTIONS.SET_CURRENT_EXPENSE, payload: expense });
  }, []);

  const clearCurrentExpense = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_CURRENT_EXPENSE });
  }, []);

  const addMessage = useCallback((message) => {
    dispatch({ type: ACTIONS.ADD_MESSAGE, payload: message });
  }, []);

  const addBotMessage = useCallback((content, data = null) => {
    dispatch({
      type: ACTIONS.ADD_MESSAGE,
      payload: { role: 'assistant', content, data }
    });
  }, []);

  const addUserMessage = useCallback((content, data = null) => {
    dispatch({
      type: ACTIONS.ADD_MESSAGE,
      payload: { role: 'user', content, data }
    });
  }, []);

  const setProcessing = useCallback((isProcessing) => {
    dispatch({ type: ACTIONS.SET_PROCESSING, payload: isProcessing });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: ACTIONS.SET_ERROR, payload: error });
  }, []);

  const addPendingUpload = useCallback((uploadId) => {
    dispatch({ type: ACTIONS.ADD_PENDING_UPLOAD, payload: uploadId });
  }, []);

  const removePendingUpload = useCallback((uploadId) => {
    dispatch({ type: ACTIONS.REMOVE_PENDING_UPLOAD, payload: uploadId });
  }, []);

  const updateReportSummary = useCallback((summary) => {
    dispatch({ type: ACTIONS.UPDATE_REPORT_SUMMARY, payload: summary });
  }, []);

  const clearAllExpenses = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ALL_EXPENSES });
  }, []);

  // Utility functions
  const getExpenseById = useCallback((id) => {
    return state.expenses.find(exp => exp.id === id);
  }, [state.expenses]);

  const getExpensesByCategory = useCallback((category) => {
    return state.expenses.filter(exp => exp.category === category);
  }, [state.expenses]);

  const getTotalAmount = useCallback(() => {
    return state.expenses.reduce((sum, exp) => sum + (exp.total || 0), 0);
  }, [state.expenses]);

  const getExpensesRequiringAttention = useCallback(() => {
    return state.expenses.filter(exp => {
      // Meals over $25 without companion
      if (exp.category === EXPENSE_CATEGORIES.MEAL &&
          exp.total > MEAL_COMPANION_THRESHOLD &&
          !exp.companionName) {
        return true;
      }
      // Hotels without itemization
      if (exp.category === EXPENSE_CATEGORIES.HOTEL &&
          (!exp.hotelItemization || exp.hotelItemization.length === 0)) {
        return true;
      }
      return false;
    });
  }, [state.expenses]);

  const value = {
    // State
    ...state,

    // Actions
    addExpense,
    updateExpense,
    removeExpense,
    setCurrentExpense,
    clearCurrentExpense,
    addMessage,
    addBotMessage,
    addUserMessage,
    setProcessing,
    setError,
    addPendingUpload,
    removePendingUpload,
    updateReportSummary,
    clearAllExpenses,

    // Utilities
    getExpenseById,
    getExpensesByCategory,
    getTotalAmount,
    getExpensesRequiringAttention
  };

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
}

// Custom hook to use expense context
// eslint-disable-next-line react-refresh/only-export-components
export function useExpense() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
}

export default ExpenseContext;
