import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, isErr = false) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, isErr }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  return { toasts, addToast };
}

export default useToast;
