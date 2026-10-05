import React from 'react';
import { Package, Truck, CheckCircle2, Clock } from 'lucide-react';
import { Order } from '../types/index.js';

interface TestOrdersHelperProps {
  orders: Order[];
  onSelectPrompt?: (prompt: string) => void;
  isCallActive?: boolean;
}

export const TestOrdersHelper: React.FC<TestOrdersHelperProps> = ({
  orders,
  onSelectPrompt
}) => {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Out for Delivery':
        return 'order-status-pill out-for-delivery';
      case 'Delivered':
        return 'order-status-pill delivered';
      case 'Processing':
        return 'order-status-pill processing';
      default:
        return 'order-status-pill';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Out for Delivery':
        return <Truck size={13} />;
      case 'Delivered':
        return <CheckCircle2 size={13} />;
      case 'Processing':
        return <Clock size={13} />;
      default:
        return <Package size={13} />;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={18} style={{ color: '#34d399' }} />
          <h3 style={{ fontSize: '1rem' }}>Test Orders Helper</h3>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>3 Mock Orders Loaded</span>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
        Evaluator quick reference: You can test live lookup, cancellation eligibility, or return requests on these real mock orders:
      </p>

      <div className="orders-list">
        {orders.map((order) => (
          <div
            key={order.id}
            className="order-card"
            onClick={() => onSelectPrompt && onSelectPrompt(`Where is my order ${order.id}?`)}
            title="Click to simulate query"
          >
            <div className="order-card-header">
              <span className="order-id-badge">{order.id}</span>
              <span className={getStatusBadgeClass(order.status)}>
                {getStatusIcon(order.status)}
                <span style={{ marginLeft: '0.3rem' }}>{order.status}</span>
              </span>
            </div>

            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f3f4f6' }}>
              {order.customerName}
            </div>

            <div style={{ fontSize: '0.78rem', color: '#34d399', margin: '0.15rem 0' }}>
              {order.product} • ₹{order.value}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {order.notes}
            </div>

            {onSelectPrompt && (
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPrompt(`Where is ${order.id}?`);
                  }}
                  className="btn btn-outline"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', borderRadius: 4 }}
                >
                  Track Status
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (order.status === 'Delivered') {
                      onSelectPrompt(`Can I return ${order.id}?`);
                    } else {
                      onSelectPrompt(`Can I cancel ${order.id}?`);
                    }
                  }}
                  className="btn btn-outline"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', borderRadius: 4 }}
                >
                  {order.status === 'Delivered' ? 'Ask Return' : 'Ask Cancel'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
