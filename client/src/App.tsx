import { useState } from 'react';

type Category = { id: number; name: string };
type ViewState = 'idle' | 'loading' | 'success' | 'error';

export default function App() {
  const [state, setState] = useState<ViewState>('idle');
  const [categories, setCategories] = useState<Category[]>([]);

  async function checkSystem() {
    setState('loading');
    setCategories([]);
    try {
      const health = await fetch('/api/health');
      if (!health.ok || (await health.json()).status !== 'ok') throw new Error();
      const categoryResponse = await fetch('/api/categories');
      if (!categoryResponse.ok) throw new Error();
      setCategories(await categoryResponse.json() as Category[]);
      setState('success');
    } catch {
      setState('error');
    }
  }

  return (
    <main className="app-shell">
      <section className="card service-card shadow-sm" aria-labelledby="app-title">
        <div className="card-body p-4 p-md-5">
          <header className="d-flex align-items-center gap-3">
            <div className="brand-mark" aria-hidden="true">TT</div>
            <div>
              <h1 id="app-title" className="h2 mb-1">TokTickIT</h1>
              <p className="text-secondary mb-0">IT Service Desk</p>
            </div>
          </header>

          <p className="mt-4 mb-0 text-secondary">Check the service connection and supported request categories.</p>

          <button className="btn btn-primary mt-4 px-4" onClick={checkSystem} disabled={state === 'loading'}>
            {state === 'loading' && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
            {state === 'loading' ? 'Checking System...' : 'Check System'}
          </button>

          <div className="mt-4" aria-live="polite">
            {state === 'loading' && <p className="mb-0 text-secondary" role="status">Loading...</p>}
            {state === 'success' && (
              <section>
                <div className="status-panel bg-success-subtle border border-success-subtle p-3">
                  <span className="fw-semibold">System Status: </span><span className="text-success-emphasis">Online</span>
                </div>
                <h2 className="h5 mt-4 mb-3">Supported Request Categories</h2>
                <ol className="list-group list-group-numbered category-list mb-0">
                  {categories.map((category) => <li className="list-group-item" key={category.id}>{category.name}</li>)}
                </ol>
              </section>
            )}
            {state === 'error' && (
              <section className="status-panel border border-danger-subtle bg-danger-subtle p-3" role="alert">
                <p className="mb-1"><strong>System Status:</strong> Offline</p>
                <p className="mb-0">Unable to connect to TokTickIT API.</p>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
