import React from 'react';
import { useParams } from 'react-router-dom';
import { usePayment, usePaymentEvents, usePaymentDeliveries, useUpdatePaymentStatus } from '../hooks/usePayment';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatCurrency, truncateId } from '../utils/format';
import { format } from 'date-fns';
import { Table, Th, Td } from '../components/ui/Table';

const PaymentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: payment, isLoading: paymentLoading } = usePayment(id!);
  const { data: events, isLoading: eventsLoading } = usePaymentEvents(id!);
  const { data: deliveries, isLoading: deliveriesLoading } = usePaymentDeliveries(id!);
  const updateStatus = useUpdatePaymentStatus();

  if (paymentLoading || eventsLoading || deliveriesLoading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;
  if (!payment) return <div className="text-red-500 p-4">Payment not found</div>;

  const handleAction = async (action: string) => {
    await updateStatus.mutateAsync({ id: id!, action });
  };

  const getValidActions = () => {
    switch (payment.status) {
      case 'PENDING': return ['authorize', 'cancel'];
      case 'AUTHORIZED': return ['capture', 'cancel'];
      case 'CAPTURED': return ['refund'];
      default: return [];
    }
  };

  const validActions = getValidActions();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm bg-surface px-2 py-1 rounded border border-border">{payment.id}</span>
            <Badge variant={
              payment.status === 'CAPTURED' ? 'success' :
              payment.status === 'FAILED' ? 'danger' :
              payment.status === 'PENDING' || payment.status === 'AUTHORIZED' ? 'warning' : 'default'
            }>
              {payment.status}
            </Badge>
          </h1>
          <p className="text-3xl mt-2 font-medium">{formatCurrency(payment.amount, payment.currency)}</p>
        </div>
        {validActions.length > 0 && (
          <div className="flex gap-2">
            {validActions.map(action => (
              <Button
                key={action}
                onClick={() => handleAction(action)}
                variant={action === 'cancel' || action === 'refund' ? 'danger' : 'primary'}
                disabled={updateStatus.isPending}
              >
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-medium border-b border-border pb-2">Details</h3>
          <div className="grid grid-cols-2 gap-y-4">
            <div>
              <p className="text-sm text-muted">Customer ID</p>
              <p className="font-mono text-sm mt-1">{payment.customer_id}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Currency</p>
              <p className="font-mono text-sm mt-1">{payment.currency}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Created At</p>
              <p className="text-sm mt-1">{format(new Date(payment.created_at), 'PPpp')}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Updated At</p>
              <p className="text-sm mt-1">{format(new Date(payment.updated_at), 'PPpp')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-medium">Event Timeline</h3>
        <Card>
          <div className="p-6 space-y-6">
            {events && events.length > 0 ? events.map((event, index) => (
              <div key={event.id} className="relative flex gap-4">
                {index !== events.length - 1 && (
                  <div className="absolute left-3 top-8 bottom-[-24px] w-0.5 bg-border"></div>
                )}
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 z-10 border border-primary/50">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-primary">{event.event_type}</h4>
                    <span className="text-xs text-muted">{format(new Date(event.created_at), 'PPpp')}</span>
                  </div>
                  <pre className="mt-2 bg-background p-3 rounded text-xs font-mono overflow-x-auto border border-border text-gray-300">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )) : (
              <p className="text-muted text-sm">No events yet.</p>
            )}
          </div>
        </Card>
      </div>

      {deliveries && deliveries.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-medium">Webhook Deliveries</h3>
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Delivery ID</Th>
                  <Th>Event Type</Th>
                  <Th>Status</Th>
                  <Th>Attempts</Th>
                  <Th>Response</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <Td><span className="font-mono text-xs">{truncateId(delivery.id)}</span></Td>
                    <Td><span className="font-mono text-xs">{delivery.event_type}</span></Td>
                    <Td>
                      <Badge variant={delivery.status === 'SUCCESS' ? 'success' : delivery.status === 'FAILED' ? 'danger' : 'warning'}>
                        {delivery.status}
                      </Badge>
                    </Td>
                    <Td>{delivery.attempt_count}</Td>
                    <Td>{delivery.last_response_status ?? '-'}</Td>
                    <Td>{format(new Date(delivery.created_at), 'MMM d, HH:mm:ss')}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
};
export default PaymentDetailPage;
