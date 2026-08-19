import React from 'react';
import { useMetrics } from '../hooks/useMetrics';
import { usePayments } from '../hooks/usePayments';
import { Card } from '../components/ui/Card';
import { Table, Th, Td } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, truncateId } from '../utils/format';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS: Record<string, string> = {
  CREATED: '#3b82f6',
  PENDING: '#f59e0b',
  AUTHORIZED: '#8b5cf6',
  CAPTURED: '#10b981',
  FAILED: '#ef4444',
  CANCELLED: '#6b7280',
  REFUNDED: '#ec4899',
};

const DashboardPage = () => {
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: payments, isLoading: paymentsLoading } = usePayments(1, 10);
  const navigate = useNavigate();

  if (metricsLoading || paymentsLoading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;
  if (!metrics) return <div className="text-red-500">Error loading metrics</div>;

  // Build pie chart data from metrics
  const statusDistribution = [
    { status: 'CAPTURED', count: metrics.payments.successful },
    { status: 'FAILED', count: metrics.payments.failed },
    { status: 'REFUNDED', count: metrics.payments.refunded },
    { status: 'OTHER', count: Math.max(0, metrics.payments.total - metrics.payments.successful - metrics.payments.failed - metrics.payments.refunded) },
  ].filter(d => d.count > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Total Payments</h3>
          <p className="text-3xl font-bold mt-2">{metrics.payments.total}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Total Volume Captured</h3>
          <p className="text-3xl font-bold mt-2">{formatCurrency(metrics.payments.totalAmount, 'INR')}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Success Rate</h3>
          <p className="text-3xl font-bold mt-2 text-emerald-500">
            {metrics.payments.successRate}%
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Failed Webhooks</h3>
          <p className="text-3xl font-bold mt-2 text-red-500">{metrics.webhooks.failed}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted">Successful</h3>
          <p className="text-xl font-bold mt-1 text-emerald-500">{metrics.payments.successful}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted">Failed</h3>
          <p className="text-xl font-bold mt-1 text-red-500">{metrics.payments.failed}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted">Refunded</h3>
          <p className="text-xl font-bold mt-1 text-purple-500">{metrics.payments.refunded}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted">Webhook Delivery Rate</h3>
          <p className="text-xl font-bold mt-1 text-blue-500">{metrics.webhooks.deliveryRate}%</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-medium mb-4">Payment Volume (Last 7 Days)</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#a3a3a3" tick={{ fontSize: 12 }} />
                <YAxis stroke="#a3a3a3" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626' }}
                  formatter={(value: number) => [value, 'Payments']}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Status Distribution</h3>
          {statusDistribution.length > 0 ? (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="status"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#a3a3a3'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#262626' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusDistribution.map((entry) => (
                  <div key={entry.status} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.status] || '#a3a3a3' }} />
                    <span className="text-muted">{entry.status} ({entry.count})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted text-sm">No payment data yet</div>
          )}
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-medium">Recent Payments</h3>
          <button
            onClick={() => navigate('/payments')}
            className="text-sm text-primary hover:underline"
          >
            View All
          </button>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Customer</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Date</Th>
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
                <Td colSpan={5} className="text-center text-muted py-8">No payments yet. Create one to get started.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};
export default DashboardPage;
