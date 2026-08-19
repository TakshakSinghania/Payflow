import React from 'react';
import { useSimulationConfig, useUpdateSimulationConfig } from '../hooks/useSimulation';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const SimulationPage = () => {
  const { data: config, isLoading } = useSimulationConfig();
  const updateConfig = useUpdateSimulationConfig();

  if (isLoading) return <div>Loading...</div>;
  if (!config) return <div>Error loading config</div>;

  const toggleConfig = (key: keyof typeof config) => {
    updateConfig.mutate({ [key]: !config[key] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-danger">Simulation Controls</h1>
        <p className="text-muted mt-2">
          PayFlow is a payment infrastructure simulator. No real payments are processed.
          Use these controls to test how your system handles various failure scenarios.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Payment Failures</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <div>
                <h4 className="font-medium">Force Payment Failure</h4>
                <p className="text-sm text-muted">All new payments will immediately fail.</p>
              </div>
              <button 
                onClick={() => toggleConfig('PAYMENT_FAILURE')}
                className={`w-12 h-6 rounded-full transition-colors relative ${config.PAYMENT_FAILURE ? 'bg-danger' : 'bg-surface border border-border'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${config.PAYMENT_FAILURE ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <div>
                <h4 className="font-medium">Random Failure (50%)</h4>
                <p className="text-sm text-muted">Payments have a 50% chance of failing.</p>
              </div>
              <button 
                onClick={() => toggleConfig('RANDOM_FAILURE')}
                className={`w-12 h-6 rounded-full transition-colors relative ${config.RANDOM_FAILURE ? 'bg-warning' : 'bg-surface border border-border'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${config.RANDOM_FAILURE ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Webhook Delivery Failures</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <div>
                <h4 className="font-medium">Webhook Server Down (500)</h4>
                <p className="text-sm text-muted">Simulate target server returning 500 errors.</p>
              </div>
              <button 
                onClick={() => toggleConfig('WEBHOOK_FAILURE')}
                className={`w-12 h-6 rounded-full transition-colors relative ${config.WEBHOOK_FAILURE ? 'bg-danger' : 'bg-surface border border-border'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${config.WEBHOOK_FAILURE ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <div>
                <h4 className="font-medium">Slow Webhooks</h4>
                <p className="text-sm text-muted">Artificially delay webhook deliveries to test timeouts.</p>
              </div>
              <button 
                onClick={() => toggleConfig('SLOW_WEBHOOK')}
                className={`w-12 h-6 rounded-full transition-colors relative ${config.SLOW_WEBHOOK ? 'bg-warning' : 'bg-surface border border-border'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${config.SLOW_WEBHOOK ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
export default SimulationPage;
