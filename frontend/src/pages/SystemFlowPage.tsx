import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const SystemFlowPage = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const steps = [
    { name: 'Client Request', desc: 'POST /payments with idempotency key' },
    { name: 'API Server', desc: 'Validates request, checks DB' },
    { name: 'PostgreSQL', desc: 'Persists payment state (CREATED)' },
    { name: 'Payment Engine', desc: 'Simulates authorization/capture' },
    { name: 'PostgreSQL (Update)', desc: 'Updates state (CAPTURED)' },
    { name: 'Redis Queue', desc: 'Pushes payment.captured event' },
    { name: 'Worker', desc: 'Pops event, prepares payload & signature' },
    { name: 'Webhook Target', desc: 'Delivers payload, records success/failure' }
  ];

  const startSimulation = () => {
    setIsSimulating(true);
    setActiveStep(0);
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps.length) {
        clearInterval(interval);
        setTimeout(() => setIsSimulating(false), 1000);
      } else {
        setActiveStep(currentStep);
      }
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Flow Visualization</h1>
          <p className="text-muted mt-2">Watch how a payment moves through the infrastructure.</p>
        </div>
        <Button onClick={startSimulation} disabled={isSimulating}>
          {isSimulating ? 'Simulating...' : 'Simulate Payment Flow'}
        </Button>
      </div>

      <div className="flex justify-center mt-12">
        <div className="relative w-full max-w-4xl">
          {/* Path Line */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-border -translate-y-1/2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-in-out" 
              style={{ width: `${isSimulating ? (activeStep / (steps.length - 1)) * 100 : 0}%` }}
            />
          </div>

          <div className="relative flex justify-between">
            {steps.map((step, idx) => {
              const isActive = isSimulating && activeStep === idx;
              const isPast = isSimulating && activeStep > idx;
              
              return (
                <div key={idx} className="flex flex-col items-center group relative">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors duration-500 ${
                      isActive ? 'bg-primary text-white scale-125 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 
                      isPast ? 'bg-success text-white' : 
                      'bg-surface border-2 border-border text-muted'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  
                  {/* Tooltip */}
                  <div className={`absolute top-12 whitespace-nowrap bg-surface border border-border p-3 rounded-lg shadow-lg transition-opacity duration-300 ${
                    isActive ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100'
                  }`}>
                    <p className="font-medium text-sm text-primary">{step.name}</p>
                    <p className="text-xs text-muted mt-1">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Current Step Description Box */}
      {isSimulating && (
        <Card className="max-w-2xl mx-auto mt-32 p-6 text-center animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-xl font-medium text-primary">{steps[activeStep].name}</h3>
          <p className="text-muted mt-2">{steps[activeStep].desc}</p>
        </Card>
      )}
    </div>
  );
};
export default SystemFlowPage;
