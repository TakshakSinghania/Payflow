import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayments, useCreatePayment } from '../hooks/usePayments';
import { Card } from '../components/ui/Card';
import { Table, Th, Td } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, truncateId } from '../utils/format';
import { format } from 'date-fns';
import { api } from '../lib/api';

const PaymentsPage = () => {
  const [page, setPage] = useState(1);
  const { data: payments, isLoading } = usePayments(page, 15);
  const createPayment = useCreatePayment();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('4999');
  const [currency, setCurrency] = useState('INR');
  const [customerId, setCustomerId] = useState('cus_demo');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      await api.post('/payments', {
        amount: parseInt(amount, 10),
        currency,
        customer_id: customerId || 'cus_anonymous',
      }, { headers });
      createPayment.reset();
      setIsModalOpen(false);
      navigate(0); // refresh
    } catch (err: unknown) {
      console.error(err);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Button onClick={() => setIsModalOpen(true)}>Create Payment</Button>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Customer</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {payments && payments.length > 0 ? payments.map((payment) => (
              <tr
                key={payment.id}
                className="hover:bg-border/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/payments/${payment.id}`)}
              >
                <Td><span className="font-mono text-xs">{truncateId(payment.id)}</span></Td>
                <Td>{payment.customer_id}</Td>
                <Td>{formatCurrency(payment.amount, payment.currency)}</Td>
                <Td>
                  <Badge variant={
                    payment.status === 'CAPTURED' ? 'success' :
                    payment.status === 'FAILED' ? 'danger' :
                    payment.status === 'PENDING' || payment.status === 'AUTHORIZED' ? 'warning' : 'default'
                  }>
                    {payment.status}
                  </Badge>
                </Td>
                <Td>{format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')}</Td>
              </tr>
            )) : (
              <tr>
                <Td colSpan={5} className="text-center text-muted py-8">No payments yet.</Td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className="flex justify-between items-center px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-muted">Page {page}</span>
          <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={!payments || payments.length < 15}>Next</Button>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Payment">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount (in smallest unit, e.g. paisa/cents)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-text"
              required
              min={1}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-text"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Customer ID</label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-text"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Idempotency Key <span className="text-muted">(optional)</span></label>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-text font-mono text-sm"
              placeholder="e.g. req_abc12345"
            />
            <p className="text-xs text-muted mt-1">Same key + same payload = same payment returned (no duplicate).</p>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default PaymentsPage;
