import React, { useState } from 'react';
import { useWebhookEndpoints, useCreateWebhookEndpoint } from '../hooks/useWebhookEndpoints';
import { Card } from '../components/ui/Card';
import { Table, Th, Td } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { format } from 'date-fns';

const WebhooksPage = () => {
  const { data: endpoints, isLoading } = useWebhookEndpoints();
  const createEndpoint = useCreateWebhookEndpoint();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createEndpoint.mutateAsync({ url });
    setUrl('');
    setCreatedSecret(result.secret);
    // Don't close modal — show the secret first
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Webhook Endpoints</h1>
        <Button onClick={() => { setIsModalOpen(true); setCreatedSecret(null); }}>Add Endpoint</Button>
      </div>

      <div className="p-4 bg-surface border border-border rounded-lg text-sm text-muted">
        <strong className="text-text">How webhook signing works:</strong> Each delivery includes an{' '}
        <code className="font-mono text-primary">X-PayFlow-Signature</code> header — an HMAC-SHA256 signature of the request body using your endpoint's secret. Verify it to ensure authenticity.
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>URL</Th>
              <Th>Status</Th>
              <Th>Secret (masked)</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {endpoints && endpoints.length > 0 ? endpoints.map((endpoint) => (
              <tr key={endpoint.id} className="hover:bg-border/30 transition-colors">
                <Td className="max-w-xs truncate">{endpoint.url}</Td>
                <Td>
                  <Badge variant={endpoint.is_active ? 'success' : 'default'}>
                    {endpoint.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </Td>
                <Td><span className="font-mono text-xs">••••••••••••{endpoint.secret.slice(-4)}</span></Td>
                <Td>{format(new Date(endpoint.created_at), 'MMM d, yyyy')}</Td>
              </tr>
            )) : (
              <tr>
                <Td colSpan={4} className="text-center text-muted py-8">No webhook endpoints found. Add one to start receiving events.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setCreatedSecret(null); }} title="Add Webhook Endpoint">
        {createdSecret ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <p className="text-sm font-medium text-emerald-400 mb-2">✓ Endpoint created successfully!</p>
              <p className="text-xs text-muted mb-2">Save this secret key — it won't be shown again:</p>
              <code className="font-mono text-xs bg-background px-3 py-2 rounded border border-border block break-all">{createdSecret}</code>
            </div>
            <Button onClick={() => { setIsModalOpen(false); setCreatedSecret(null); }}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Endpoint URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-text"
                placeholder="https://your-domain.com/webhook"
                required
              />
              <p className="text-xs text-muted mt-2">
                We'll send signed POST requests here for all payment events.
              </p>
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createEndpoint.isPending}>
                {createEndpoint.isPending ? 'Adding...' : 'Add Endpoint'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default WebhooksPage;
