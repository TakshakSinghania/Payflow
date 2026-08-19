import React, { useState } from 'react';
import { useWebhookDeliveries } from '../hooks/useWebhookDeliveries';
import { Card } from '../components/ui/Card';
import { Table, Th, Td } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { format } from 'date-fns';
import { truncateId } from '../utils/format';

const WebhookDeliveriesPage = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useWebhookDeliveries(page, 50);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Webhook Deliveries</h1>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Event Type</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th>Attempts</Th>
              <Th>Next Retry</Th>
              <Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {data?.deliveries && data.deliveries.length > 0 ? data.deliveries.map((delivery) => (
              <tr key={delivery.id} className="hover:bg-border/30 transition-colors">
                <Td><span className="font-mono text-xs">{truncateId(delivery.id)}</span></Td>
                <Td><span className="font-mono text-xs">{delivery.event_type}</span></Td>
                <Td><span className="font-mono text-xs">{truncateId(delivery.payment_id)}</span></Td>
                <Td>
                  <Badge variant={
                    delivery.status === 'SUCCESS' ? 'success' :
                    delivery.status === 'FAILED' ? 'danger' : 'warning'
                  }>
                    {delivery.status}
                  </Badge>
                </Td>
                <Td>{delivery.attempt_count}</Td>
                <Td>{delivery.next_retry_at ? format(new Date(delivery.next_retry_at), 'HH:mm:ss') : '-'}</Td>
                <Td>{format(new Date(delivery.created_at), 'MMM d, HH:mm:ss')}</Td>
              </tr>
            )) : (
              <tr>
                <Td colSpan={7} className="text-center text-muted py-8">No webhook deliveries yet.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      {data && data.total > 50 && (
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-muted">Page {page} · {data.total} total</span>
          <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={!data.deliveries || data.deliveries.length < 50}>Next</Button>
        </div>
      )}
    </div>
  );
};
export default WebhookDeliveriesPage;
