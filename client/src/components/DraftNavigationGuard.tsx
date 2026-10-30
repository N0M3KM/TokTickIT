import { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';
import { useBlocker } from 'react-router-dom';

const DraftContext = createContext<((id: string, active: boolean) => void) | null>(null);

/** A router supports one blocker; every ticket editor registers with this owner. */
export default function DraftNavigationGuard({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Set<string>>(() => new Set());
  const register = useCallback((id: string, active: boolean) => {
    setDrafts(current => {
      if (current.has(id) === active) return current;
      const next = new Set(current);
      if (active) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const active = drafts.size > 0;
  const blocker = useBlocker(active);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Leave this page and discard unsaved ticket or action changes?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const signOut = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.lab3-identity button') && !window.confirm('Sign out and discard unsaved ticket or action changes?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn); document.addEventListener('click', signOut, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', signOut, true); };
  }, [active]);
  return <DraftContext.Provider value={register}>{children}</DraftContext.Provider>;
}

export function useUnsavedChanges(active: boolean) {
  const id = useId();
  const register = useContext(DraftContext);
  useEffect(() => { register?.(id, active); return () => register?.(id, false); }, [register, id, active]);
}
