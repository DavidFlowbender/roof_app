import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

/**
 * Compact circular "i" button placed next to the Level (Foundation / Parapet) selector.
 * Opens a simple-English explanation of what each building measurement level means.
 */
export default function LevelInfoButton({ size = 18 }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="What does Level mean?"
        aria-label="What does Level mean?"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '999px',
          border: '1px solid rgba(56, 189, 248, 0.55)',
          background: 'rgba(14, 165, 233, 0.14)',
          color: '#38bdf8',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Info style={{ width: `${Math.max(10, size - 6)}px`, height: `${Math.max(10, size - 6)}px` }} />
      </button>

      {open && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9900 }}
          onClick={() => setOpen(false)}
        >
          <div
            className="modal-card"
            style={{ maxWidth: '410px', width: '92vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '999px',
                    background: 'rgba(14, 165, 233, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Info className="w-4 h-4" />
                </div>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1rem' }}>
                  What does &ldquo;Level&rdquo; mean?
                </h3>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.55 }}>
              Pick the stage the building was at when the measurements were taken on site:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#34d399', marginBottom: '4px' }}>
                  1. Foundation Level (+0.5m per side)
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5 }}>
                  Choose this if the building is still at <strong>foundation or wall level</strong> and the
                  parapet has <strong>not</strong> been built yet. We automatically add{' '}
                  <strong>0.5m on every side</strong> (editable) to cover the parapet/eaves that will be
                  built later.
                </p>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
                  2. Parapet Level (+0m exact)
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5 }}>
                  Choose this if the <strong>parapet or roof woodwork is already built</strong> and your
                  measurements were taken from outer edge to outer edge. We keep your measurements{' '}
                  <strong>exact</strong> without adding anything.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary-action"
              onClick={() => setOpen(false)}
              style={{ width: '100%', marginTop: '14px', justifyContent: 'center' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
