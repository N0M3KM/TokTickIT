import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RequesterContextValue {
  selectedRequesterId: number | null;
  selectedRequesterName: string | null;
  setRequester: (id: number, name: string) => void;
  clearRequester: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const RequesterContext = createContext<RequesterContextValue>({
  selectedRequesterId: null,
  selectedRequesterName: null,
  setRequester: () => {},
  clearRequester: () => {},
});

const STORAGE_ID_KEY   = 'devRequesterId';
const STORAGE_NAME_KEY = 'devRequesterName';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function RequesterProvider({ children }: { children: React.ReactNode }) {
  const [selectedRequesterId,   setSelectedRequesterId]   = useState<number | null>(null);
  const [selectedRequesterName, setSelectedRequesterName] = useState<string | null>(null);

  // Rehydrate from localStorage on mount (BR-03, spec §11 Decision #3)
  useEffect(() => {
    const storedId   = localStorage.getItem(STORAGE_ID_KEY);
    const storedName = localStorage.getItem(STORAGE_NAME_KEY);
    if (storedId && storedName) {
      setSelectedRequesterId(Number(storedId));
      setSelectedRequesterName(storedName);
    }
  }, []);

  const setRequester = useCallback((id: number, name: string) => {
    localStorage.setItem(STORAGE_ID_KEY,   String(id));
    localStorage.setItem(STORAGE_NAME_KEY, name);
    setSelectedRequesterId(id);
    setSelectedRequesterName(name);
  }, []);

  const clearRequester = useCallback(() => {
    localStorage.removeItem(STORAGE_ID_KEY);
    localStorage.removeItem(STORAGE_NAME_KEY);
    setSelectedRequesterId(null);
    setSelectedRequesterName(null);
  }, []);

  return (
    <RequesterContext.Provider
      value={{ selectedRequesterId, selectedRequesterName, setRequester, clearRequester }}
    >
      {children}
    </RequesterContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useRequester(): RequesterContextValue {
  return useContext(RequesterContext);
}
