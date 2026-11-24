import React from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

/**
 * Clean, non-intrusive "Install RoofCalc Pro App" prompt for Android Chrome, Edge & iPhone Safari.
 * Automatically stays hidden once installed (standalone mode) or dismissed.
 */
export default function InstallAppBanner({
  showBanner = false,
  isIos = false,
  iosGuideOpen = false,
  onInstall,
  onDismiss,
  onCloseIosGuide,
}) {
  return (
    <>
      {showBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: 'max(14px, env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9500,
            width: 'min(420px, calc(100vw - 24px))',
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            borderRadius: '14px',
            padding: '10px 12px',
            boxShadow: '0 14px 36px rgba(2, 6, 23, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <img
              src="/icon-192.png"
              alt="RoofCalc Pro"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                flexShrink: 0,
                border: '1px solid rgba(56, 189, 248, 0.35)',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>
                Install RoofCalc Pro
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.3 }}>
                Full-screen app on your home screen
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onInstall}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 11px',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={13} />
              <span>Install</span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss install banner"
              style={{
                background: 'rgba(30, 41, 59, 0.85)',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: '7px',
                width: '28px',
                height: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* iPhone / iPad Safari 2-step Install Guide Modal */}
      {iosGuideOpen && isIos && (
        <div className="modal-overlay" onClick={onCloseIosGuide}>
          <div
            className="modal-card"
            style={{ maxWidth: '390px', width: '92vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="/icon-192.png"
                  alt="RoofCalc Pro"
                  style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                />
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1rem' }}>
                  Install RoofCalc Pro on iPhone
                </h3>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={onCloseIosGuide}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0 0.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                Add <strong>RoofCalc Pro</strong> to your Home Screen for instant full-screen launch — no App Store needed:
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0.7rem 0.85rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(51, 65, 85, 0.7)',
                  fontSize: '0.82rem',
                  color: '#f8fafc',
                }}
              >
                <Share size={18} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <span>
                  <strong>1.</strong> Tap the <strong>Share</strong> icon in Safari&apos;s bottom bar.
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0.7rem 0.85rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(51, 65, 85, 0.7)',
                  fontSize: '0.82rem',
                  color: '#f8fafc',
                }}
              >
                <PlusSquare size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                <span>
                  <strong>2.</strong> Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                </span>
              </div>

              <button
                type="button"
                className="btn-primary-action"
                onClick={onCloseIosGuide}
                style={{ marginTop: '0.25rem', width: '100%' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
