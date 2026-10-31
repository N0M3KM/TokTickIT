import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { fetchStaffDashboard, StaffDashboardFailure, type FailureKind, type Metric, type StaffDashboardDTO } from './api.js';
import './dashboard.css';

const bangkok = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
const dateLabel = (value: string) => `${bangkok.format(new Date(value))} (Bangkok)`;
const humanize = (value: string) => value.replace(/_/g, ' ');
interface LoadState { identity: string; pending: boolean; data?: StaffDashboardDTO; error?: FailureKind }
function MetricCard({ metric, title, label }: { metric: Metric; title: string; label: string }) {
  return <Link className="staff-dashboard__metric" to={metric.href} aria-label={label}><h2>{title}</h2><span className="staff-dashboard__count">{metric.count}</span></Link>;
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const staff = user?.role === 'IT_STAFF' || user?.role === 'ADMINISTRATOR';
  const identity = user ? `${user.id}:${user.role}` : '';
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState>({ identity: '', pending: true });
  useEffect(() => {
    if (!staff || !identity) { setState({ identity: '', pending: false }); return; }
    const controller = new AbortController();
    setState(previous => ({ identity, pending: true, data: previous.identity === identity ? previous.data : undefined }));
    fetchStaffDashboard(controller.signal).then(data => { if (!controller.signal.aborted) setState({ identity, pending: false, data }); })
      .catch(reason => {
        if (controller.signal.aborted) return;
        const kind = reason instanceof StaffDashboardFailure ? reason.kind : 'failure';
        setState(previous => ({ identity, pending: false, error: kind, data: kind === 'failure' && previous.identity === identity ? previous.data : undefined }));
      });
    return () => controller.abort();
  }, [identity, staff, refresh]);
  if (!user) return <p role="alert">Sign in to view your dashboard.</p>;
  if (!staff) return <section className="staff-dashboard"><h1>Dashboard</h1><p role="alert">This dashboard is available to IT Staff and Administrators only.</p><Link to="/dashboard">Open requester dashboard</Link></section>;
  const current: LoadState = state.identity === identity ? state : { identity, pending: true };
  const data = current.data;
  return <div className="staff-dashboard" aria-busy={current.pending}>
    <header className="staff-dashboard__header"><div><h1>Dashboard</h1><p>Operational overview</p></div><div><Link className="staff-dashboard__primary" to="/queue">Open Ticket Queue</Link><button type="button" disabled={current.pending} onClick={() => setRefresh(value => value + 1)}>Refresh dashboard</button></div></header>
    {current.pending ? <p role="status">{data ? 'Refreshing dashboard...' : 'Loading dashboard...'}</p> : null}
    {current.error ? <div role="alert" className="staff-dashboard__error"><p>{data ? `Could not refresh; showing data from ${dateLabel(data.asOf)}.` : current.error === 'forbidden' ? 'You do not have access to this dashboard.' : current.error === 'not-found' ? 'Dashboard not found.' : current.error === 'unauthenticated' ? 'Your session expired. Sign in again to view your dashboard.' : 'Could not load your dashboard. Please try again.'}</p>{current.error === 'failure' ? <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry dashboard</button> : <Link to={current.error === 'unauthenticated' ? '/login?redirectAfterLogin=%2Fdashboard' : '/queue'}>{current.error === 'unauthenticated' ? 'Sign in' : 'Open Ticket Queue'}</Link>}</div> : null}
    {data ? <>
      <p>Updated at <time dateTime={data.asOf}>{dateLabel(data.asOf)}</time></p><p>Recent activity window: <time dateTime={data.window.from}>{dateLabel(data.window.from)}</time> to <time dateTime={data.window.to}>{dateLabel(data.window.to)}</time></p>
      <section className="staff-dashboard__metrics" aria-label="Operational metrics">
        <MetricCard metric={data.metrics.unassigned} title="Unassigned tickets" label={`View ${data.metrics.unassigned.count} unassigned tickets`} />
        <MetricCard metric={data.metrics.ownedByMe} title="My active tickets" label={`View ${data.metrics.ownedByMe.count} active tickets assigned to me`} />
        <Link className="staff-dashboard__metric" to={data.myActions.href} aria-label={`View ${data.myActions.ticketCount} related tickets for my ${data.myActions.actionCount} active actions`}><h2>My active actions</h2><span className="staff-dashboard__count">{data.myActions.actionCount} actions</span><span>{data.myActions.ticketCount} related tickets</span></Link>
        <MetricCard metric={data.metrics.recentlyUpdated} title="Recently updated tickets" label={`View ${data.metrics.recentlyUpdated.count} recently updated tickets`} />
      </section>
      <div className="staff-dashboard__buckets"><section className="staff-dashboard__panel" aria-label="Tickets by status"><h2>Tickets by status</h2><ul>{data.metrics.byStatus.map(bucket => <li key={bucket.status}><Link to={bucket.href} aria-label={`View ${bucket.count} ${humanize(bucket.status).toLowerCase()} tickets`}><span>{humanize(bucket.status)}</span><strong>{bucket.count}</strong></Link></li>)}</ul></section>
        <section className="staff-dashboard__panel" aria-label="Active tickets by IT priority"><h2>Active tickets by IT priority</h2><ul>{data.metrics.byPriority.map(bucket => <li key={bucket.itPriority}><Link to={bucket.href} aria-label={`View ${bucket.count} active ${bucket.itPriority.toLowerCase()} priority tickets`}><span>{bucket.itPriority}</span><strong>{bucket.count}</strong></Link></li>)}</ul></section></div>
      <section className="staff-dashboard__panel" aria-label="My active actions"><header><h2>My active actions</h2><Link to={data.myActions.href}>View {data.myActions.ticketCount} related tickets</Link></header><p>{data.myActions.actionCount} active actions assigned to you across {data.myActions.ticketCount} related tickets. Assignment is separate from who recorded an action or owns its ticket.</p>
        {data.myActions.items.length === 0 ? <p>No actions assigned to you</p> : <ul className="staff-dashboard__previews">{data.myActions.items.map(action => <li key={action.id}><Link to={action.href} className="staff-dashboard__preview-link" aria-label={`View action ${action.id} on ticket ${action.ticketNumber}: ${action.description}`}><strong>{action.ticketNumber}</strong><span>{action.description}</span></Link><dl><div><dt>Action status</dt><dd>{action.status === 'PLANNED' ? 'Planned' : 'In progress'}</dd></div><div><dt>Follow-up required</dt><dd>{action.followUpRequired ? 'Yes' : 'No'}</dd></div><div><dt>Action date/time</dt><dd><time dateTime={action.actionAt}>{dateLabel(action.actionAt)}</time></dd></div></dl></li>)}</ul>}
      </section>
      <section className="staff-dashboard__panel" aria-label="Recently updated tickets"><header><h2>Recently updated tickets</h2><Link to={data.metrics.recentlyUpdated.href}>View matching recently updated tickets</Link></header>
        {data.recentTickets.length === 0 ? <p>No recently updated tickets</p> : <ul className="staff-dashboard__previews">{data.recentTickets.map(ticket => <li key={ticket.id}><Link to={ticket.href} className="staff-dashboard__preview-link" aria-label={`View ticket ${ticket.ticketNumber}: ${ticket.summary}`}><strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span></Link><dl><div><dt>IT Priority</dt><dd>{ticket.itPriority}</dd></div><div><dt>Ticket status</dt><dd>{humanize(ticket.currentStatus)}</dd></div><div><dt>Ticket Owner</dt><dd>{ticket.ticketOwner?.name ?? 'Unassigned'}</dd></div><div><dt>Updated</dt><dd><time dateTime={ticket.updatedAt}>{dateLabel(ticket.updatedAt)}</time></dd></div></dl></li>)}</ul>}
      </section>
    </> : null}
  </div>;
}
