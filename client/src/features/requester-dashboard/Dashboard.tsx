import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { DashboardFailure, fetchRequesterDashboard, type DashboardFailureKind, type MetricKey, type RequesterDashboardDTO, type TicketPreview } from './api.js';
import './dashboard.css';

const bangkokTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
const dateLabel = (instant: string) => `${bangkokTime.format(new Date(instant))} (Bangkok)`;
const metrics: { key: MetricKey; label: string; destination: string }[] = [
  { key: 'open', label: 'Open tickets', destination: 'open tickets' },
  { key: 'waiting', label: 'Waiting for you', destination: 'tickets waiting for you' },
  { key: 'recentlyResolved', label: 'Recently resolved', destination: 'recently resolved tickets' },
  { key: 'recentlyUpdated', label: 'Recently updated', destination: 'recently updated tickets' },
];
interface LoadState { ownerId: number | null; pending: boolean; data?: RequesterDashboardDTO; error?: DashboardFailureKind }

function RecentList({ resolved, tickets, href }: { resolved: boolean; tickets: TicketPreview[]; href: string }) {
  return <section className="requester-dashboard__list" aria-label={resolved ? 'Recently resolved tickets' : 'Recently updated tickets'}>
    <header><h2>{resolved ? 'Recently resolved tickets' : 'Recently updated tickets'}</h2><Link to={href}>View matching {resolved ? 'recently resolved' : 'recently updated'} tickets</Link></header>
    {tickets.length === 0 ? <p>{resolved ? 'No recently resolved tickets' : 'No recently updated tickets'}</p> : <ul>{tickets.map(ticket => <li key={ticket.id}>
      <Link className="requester-dashboard__ticket-link" to={ticket.href} aria-label={`View ticket ${ticket.ticketNumber}: ${ticket.summary}`}><strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span></Link>
      <dl><div><dt>Status</dt><dd>{ticket.currentStatus.replace(/_/g, ' ')}</dd></div><div><dt>IT Priority</dt><dd>{ticket.itPriority}</dd></div><div><dt>{resolved ? 'Resolved' : 'Updated'}</dt><dd><time dateTime={resolved ? ticket.resolvedAt! : ticket.updatedAt}>{dateLabel(resolved ? ticket.resolvedAt! : ticket.updatedAt)}</time>{resolved && ticket.resolutionTimeEstimated ? <span> · Estimated from legacy record</span> : null}</dd></div></dl>
    </li>)}</ul>}
  </section>;
}

export default function RequesterDashboard() {
  const { user } = useAuth();
  const requester = user?.role === 'REQUESTER';
  const userId = user?.id ?? null;
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState>({ ownerId: null, pending: true });
  useEffect(() => {
    if (!requester || userId === null) { setState({ ownerId: null, pending: false }); return; }
    const controller = new AbortController();
    setState(previous => ({ ownerId: userId, pending: true, data: previous.ownerId === userId ? previous.data : undefined }));
    fetchRequesterDashboard(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ ownerId: userId, pending: false, data });
    }).catch(reason => {
      if (controller.signal.aborted) return;
      const kind = reason instanceof DashboardFailure ? reason.kind : 'failure';
      setState(previous => ({ ownerId: userId, pending: false, error: kind, data: kind === 'failure' && previous.ownerId === userId ? previous.data : undefined }));
    });
    return () => controller.abort();
  }, [userId, requester, refresh]);
  if (!user) return <p role="alert">Sign in to view your dashboard.</p>;
  if (!requester) return <section className="requester-dashboard"><h1>Dashboard</h1><p role="alert">This dashboard is available to requesters only.</p><Link to="/queue">Open Ticket Queue</Link></section>;
  const current = state.ownerId === userId ? state : { ownerId: userId, pending: true } as LoadState;
  const data = current.data;
  return <div className="requester-dashboard" aria-busy={current.pending}>
    <header className="requester-dashboard__header"><div><h1>Dashboard</h1><p>My service requests</p></div><div><Link className="requester-dashboard__primary" to="/tickets/new">Create Ticket</Link><button type="button" disabled={current.pending} onClick={() => setRefresh(value => value + 1)}>Refresh dashboard</button></div></header>
    {current.pending ? <p role="status">{data ? 'Refreshing dashboard...' : 'Loading dashboard...'}</p> : null}
    {current.error ? <div role="alert" className="requester-dashboard__error">
      <p>{data ? `Could not refresh; showing data from ${dateLabel(data.asOf)}.` : current.error === 'forbidden' ? 'You do not have access to this dashboard.' : current.error === 'not-found' ? 'Dashboard not found.' : current.error === 'unauthenticated' ? 'Your session expired. Sign in again to view your dashboard.' : 'Could not load your dashboard. Please try again.'}</p>
      {current.error === 'failure' ? <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry dashboard</button> : <Link to={current.error === 'unauthenticated' ? '/login?redirectAfterLogin=%2Fdashboard' : '/tickets'}>{current.error === 'unauthenticated' ? 'Sign in' : 'My Tickets'}</Link>}
    </div> : null}
    {data ? <>
      <p>Updated at <time dateTime={data.asOf}>{dateLabel(data.asOf)}</time></p>
      <p>Recent activity window: <time dateTime={data.window.from}>{dateLabel(data.window.from)}</time> to <time dateTime={data.window.to}>{dateLabel(data.window.to)}</time></p>
      <section className="requester-dashboard__metrics" aria-label="My ticket metrics">{metrics.map(metric => <Link key={metric.key} className={`requester-dashboard__metric requester-dashboard__metric--${metric.key}`} to={data.metrics[metric.key].href} aria-label={`View ${data.metrics[metric.key].count} ${metric.destination}`}><h2>{metric.label}</h2><span className="requester-dashboard__count">{data.metrics[metric.key].count}</span></Link>)}</section>
      <RecentList resolved={false} tickets={data.recentTickets} href={data.metrics.recentlyUpdated.href} />
      <RecentList resolved tickets={data.recentResolvedTickets} href={data.metrics.recentlyResolved.href} />
    </> : null}
  </div>;
}
