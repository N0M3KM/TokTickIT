import { useState } from 'react';

type Category = { id: number; name: string };
type ViewState = 'idle' | 'loading' | 'success' | 'error';

export default function App() {
  const [state, setState] = useState<ViewState>('idle');
  const [categories, setCategories] = useState<Category[]>([]);
  async function checkSystem() {
    setState('loading');
    try {
      const health = await fetch('/api/health');
      if (!health.ok || (await health.json()).status !== 'ok') throw new Error();
      const categoryResponse = await fetch('/api/categories');
      if (!categoryResponse.ok) throw new Error();
      setCategories(await categoryResponse.json() as Category[]);
      setState('success');
    } catch { setCategories([]); setState('error'); }
  }
  return <main className="container py-5" style={{ maxWidth: 680 }}>
    <h1 className="h2">TokTickIT <span className="text-secondary">IT Service Desk</span></h1>
    <button className="btn btn-primary mt-3" onClick={checkSystem} disabled={state === 'loading'}>Check System</button>
    {state === 'loading' && <p className="mt-4" role="status">⌛ Loading...</p>}
    {state === 'success' && <section className="mt-4"><p><strong>System Status:</strong> Online</p><h2 className="h5">Supported Request Categories</h2><ol>{categories.map((c) => <li key={c.id}>{c.name}</li>)}</ol></section>}
    {state === 'error' && <section className="mt-4" role="alert"><p><strong>System Status:</strong> Offline</p><p>Unable to connect to TokTickIT API.</p></section>}
  </main>;
}

