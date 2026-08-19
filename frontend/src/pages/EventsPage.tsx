import React, { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { Card } from '../components/ui/Card';
import { format } from 'date-fns';
import { truncateId } from '../utils/format';
import { Button } from '../components/ui/Button';

const EventsPage = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useEvents(page, 50);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Event Log</h1>
      <div className="space-y-4">
        {data?.events && data.events.length > 0 ? data.events.map((event) => (
          <Card key={event.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm text-muted">{truncateId(event.id)}</span>
                <span className="font-medium text-primary">{event.event_type}</span>
                <span className="font-mono text-xs px-2 py-1 bg-surface border border-border rounded">
                  Payment: {truncateId(event.payment_id)}
                </span>
              </div>
              <span className="text-sm text-muted">{format(new Date(event.created_at), 'MMM d, yyyy HH:mm:ss')}</span>
            </div>
            <pre className="bg-background p-3 rounded text-xs font-mono overflow-x-auto border border-border text-gray-300">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </Card>
        )) : (
          <Card className="p-8 text-center text-muted">No events yet. Create a payment to see events.</Card>
        )}
      </div>
      {data && data.total > 50 && (
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-muted">Page {page} · {data.total} total events</span>
          <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={!data.events || data.events.length < 50}>Next</Button>
        </div>
      )}
    </div>
  );
};
export default EventsPage;
