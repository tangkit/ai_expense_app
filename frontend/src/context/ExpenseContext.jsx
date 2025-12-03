import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { EXPENSE_CATEGORIES, MEAL_COMPANION_THRESHOLD } from '../constants/expenseTypes';

// Storage key for persistence
const STORAGE_KEY = 'expense_claim_data';
const EMPLOYEE_INFO_KEY = 'employee_info'; // Persistent employee info across sessions

// Load persisted employee info (separate from expense data)
function loadEmployeeInfo() {
  try {
    const saved = localStorage.getItem(EMPLOYEE_INFO_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load employee info:', error);
  }
  return null;
}

// Load persisted state from localStorage
function loadPersistedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const employeeInfo = loadEmployeeInfo();

    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        expenses: parsed.expenses || [],
        messages: parsed.messages || [],
        claimInfo: {
          ...parsed.claimInfo,
          // Merge with persistent employee info
          employeeName: employeeInfo?.employeeName || parsed.claimInfo?.employeeName || '',
          jobPosition: employeeInfo?.jobPosition || parsed.claimInfo?.jobPosition || '',
          department: employeeInfo?.department || parsed.claimInfo?.department || '',
        },
        companyTemplate: parsed.companyTemplate || null,
        uploadedReceipts: parsed.uploadedReceipts || []
      };
    }

    // Return employee info even if no saved expense data
    if (employeeInfo) {
      return {
        claimInfo: {
          employeeName: employeeInfo.employeeName || '',
          jobPosition: employeeInfo.jobPosition || '',
          department: employeeInfo.department || '',
        }
      };
    }
  } catch (error) {
    console.error('Failed to load persisted state:', error);
  }
  return null;
}

// Initial state
const getInitialState = () => {
  const persisted = loadPersistedState();
  return {
    expenses: persisted?.expenses || [],
    currentExpense: null,
    pendingExpenses: [], // Multiple expenses awaiting review (from multi-receipt documents)
    messages: persisted?.messages || [],
    isProcessing: false,
    error: null,
    pendingUploads: [],
    reportSummary: null,
    // Claim info fields
    claimInfo: persisted?.claimInfo || {
      claimName: '',
      expenseTitle: '',  // Generated from businessPurpose
      businessPurpose: '',
      // Employee info (persisted separately)
      employeeName: '',
      jobPosition: '',
      department: '',
      submissionDate: new Date().toISOString().split('T')[0],
      // Approval info
      approverName: '',
      approverTitle: ''
    },
    companyTemplate: persisted?.companyTemplate || null,
    uploadedReceipts: persisted?.uploadedReceipts || [], // Store receipt files as base64
    isInitialized: false
  };
};

// Action types
const ACTIONS = {
  ADD_EXPENSE: 'ADD_EXPENSE',
  UPDATE_EXPENSE: 'UPDATE_EXPENSE',
  REMOVE_EXPENSE: 'REMOVE_EXPENSE',
  SET_CURRENT_EXPENSE: 'SET_CURRENT_EXPENSE',
  CLEAR_CURRENT_EXPENSE: 'CLEAR_CURRENT_EXPENSE',
  SET_PENDING_EXPENSES: 'SET_PENDING_EXPENSES',
  UPDATE_PENDING_EXPENSE: 'UPDATE_PENDING_EXPENSE',
  REMOVE_PENDING_EXPENSE: 'REMOVE_PENDING_EXPENSE',
  CLEAR_PENDING_EXPENSES: 'CLEAR_PENDING_EXPENSES',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_MESSAGES: 'SET_MESSAGES',
  SET_PROCESSING: 'SET_PROCESSING',
  SET_ERROR: 'SET_ERROR',
  ADD_PENDING_UPLOAD: 'ADD_PENDING_UPLOAD',
  REMOVE_PENDING_UPLOAD: 'REMOVE_PENDING_UPLOAD',
  UPDATE_REPORT_SUMMARY: 'UPDATE_REPORT_SUMMARY',
  CLEAR_ALL_EXPENSES: 'CLEAR_ALL_EXPENSES',
  // New actions
  UPDATE_CLAIM_INFO: 'UPDATE_CLAIM_INFO',
  SET_COMPANY_TEMPLATE: 'SET_COMPANY_TEMPLATE',
  ADD_UPLOADED_RECEIPT: 'ADD_UPLOADED_RECEIPT',
  SET_INITIALIZED: 'SET_INITIALIZED',
  LOAD_PERSISTED_STATE: 'LOAD_PERSISTED_STATE'
};

// Reducer function
function expenseReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_EXPENSE:
      // Add expense and sort by date (earliest first)
      const newExpenses = [...state.expenses, action.payload].sort((a, b) => {
        const dateA = new Date(a.date || '1900-01-01');
        const dateB = new Date(b.date || '1900-01-01');
        return dateA - dateB;
      });
      return {
        ...state,
        expenses: newExpenses,
        currentExpense: null
      };

    case ACTIONS.UPDATE_EXPENSE:
      // Update expense and re-sort by date (in case date changed)
      const updatedExpenses = state.expenses.map(exp =>
        exp.id === action.payload.id ? { ...exp, ...action.payload } : exp
      ).sort((a, b) => {
        const dateA = new Date(a.date || '1900-01-01');
        const dateB = new Date(b.date || '1900-01-01');
        return dateA - dateB;
      });
      return {
        ...state,
        expenses: updatedExpenses
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

    case ACTIONS.SET_PENDING_EXPENSES:
      return {
        ...state,
        pendingExpenses: action.payload
      };

    case ACTIONS.UPDATE_PENDING_EXPENSE:
      return {
        ...state,
        pendingExpenses: state.pendingExpenses.map(exp =>
          exp.id === action.payload.id ? { ...exp, ...action.payload } : exp
        )
      };

    case ACTIONS.REMOVE_PENDING_EXPENSE:
      return {
        ...state,
        pendingExpenses: state.pendingExpenses.filter(exp => exp.id !== action.payload)
      };

    case ACTIONS.CLEAR_PENDING_EXPENSES:
      return {
        ...state,
        pendingExpenses: []
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

    case ACTIONS.SET_MESSAGES:
      return {
        ...state,
        messages: action.payload
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
        reportSummary: null,
        uploadedReceipts: []
      };

    case ACTIONS.UPDATE_CLAIM_INFO:
      return {
        ...state,
        claimInfo: { ...state.claimInfo, ...action.payload }
      };

    case ACTIONS.SET_COMPANY_TEMPLATE:
      return {
        ...state,
        companyTemplate: action.payload
      };

    case ACTIONS.ADD_UPLOADED_RECEIPT:
      return {
        ...state,
        uploadedReceipts: [...state.uploadedReceipts, action.payload]
      };

    case ACTIONS.SET_INITIALIZED:
      return {
        ...state,
        isInitialized: true
      };

    default:
      return state;
  }
}

// Create context
const ExpenseContext = createContext(null);

// Provider component
export function ExpenseProvider({ children }) {
  const [state, dispatch] = useReducer(expenseReducer, undefined, getInitialState);
  const isInitializedRef = useRef(false);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (!state.isInitialized) return;

    // Note: uploadedReceipts are NOT persisted to localStorage because base64 images
    // can easily exceed localStorage quota limits (5-10MB). Receipts are kept in memory
    // for the current session only. Users should export before closing the page.
    const dataToSave = {
      expenses: state.expenses,
      messages: state.messages,
      claimInfo: state.claimInfo,
      companyTemplate: state.companyTemplate
      // uploadedReceipts intentionally excluded - too large for localStorage
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to persist state:', error);
      // If still failing, try saving without companyTemplate (which also has large fileContent)
      try {
        const minimalSave = {
          expenses: state.expenses,
          messages: state.messages,
          claimInfo: state.claimInfo
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalSave));
        console.warn('Saved minimal state due to quota - template not persisted');
      } catch (innerError) {
        console.error('Failed even minimal persist:', innerError);
      }
    }
  }, [state.expenses, state.messages, state.claimInfo, state.companyTemplate, state.uploadedReceipts, state.isInitialized]);

  // Persist employee info separately (survives expense data clearing)
  useEffect(() => {
    if (!state.isInitialized) return;

    const employeeInfo = {
      employeeName: state.claimInfo?.employeeName || '',
      jobPosition: state.claimInfo?.jobPosition || '',
      department: state.claimInfo?.department || ''
    };

    // Only save if at least one field has a value
    if (employeeInfo.employeeName || employeeInfo.jobPosition || employeeInfo.department) {
      try {
        localStorage.setItem(EMPLOYEE_INFO_KEY, JSON.stringify(employeeInfo));
      } catch (error) {
        console.error('Failed to persist employee info:', error);
      }
    }
  }, [state.claimInfo?.employeeName, state.claimInfo?.jobPosition, state.claimInfo?.department, state.isInitialized]);

  // Mark as initialized after first render (prevents StrictMode double initialization)
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      dispatch({ type: ACTIONS.SET_INITIALIZED });
    }
  }, []);

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

  const setPendingExpenses = useCallback((expenses) => {
    dispatch({ type: ACTIONS.SET_PENDING_EXPENSES, payload: expenses });
  }, []);

  const updatePendingExpense = useCallback((id, updates) => {
    dispatch({ type: ACTIONS.UPDATE_PENDING_EXPENSE, payload: { id, ...updates } });
  }, []);

  const removePendingExpense = useCallback((id) => {
    dispatch({ type: ACTIONS.REMOVE_PENDING_EXPENSE, payload: id });
  }, []);

  const clearPendingExpenses = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_PENDING_EXPENSES });
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

  // New action creators
  const updateClaimInfo = useCallback((info) => {
    dispatch({ type: ACTIONS.UPDATE_CLAIM_INFO, payload: info });
  }, []);

  const setCompanyTemplate = useCallback((template) => {
    dispatch({ type: ACTIONS.SET_COMPANY_TEMPLATE, payload: template });
  }, []);

  const addUploadedReceipt = useCallback((receipt) => {
    dispatch({ type: ACTIONS.ADD_UPLOADED_RECEIPT, payload: receipt });
  }, []);

  const clearChat = useCallback(() => {
    dispatch({ type: ACTIONS.SET_MESSAGES, payload: [] });
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

  // Get expenses sorted by date for PDF export
  const getExpensesSortedByDate = useCallback(() => {
    return [...state.expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
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
    setPendingExpenses,
    updatePendingExpense,
    removePendingExpense,
    clearPendingExpenses,
    addMessage,
    addBotMessage,
    addUserMessage,
    setProcessing,
    setError,
    addPendingUpload,
    removePendingUpload,
    updateReportSummary,
    clearAllExpenses,
    // New actions
    updateClaimInfo,
    setCompanyTemplate,
    addUploadedReceipt,
    clearChat,

    // Utilities
    getExpenseById,
    getExpensesByCategory,
    getTotalAmount,
    getExpensesRequiringAttention,
    getExpensesSortedByDate
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
