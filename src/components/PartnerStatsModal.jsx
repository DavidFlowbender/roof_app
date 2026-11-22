import React, { useEffect, useState } from 'react';
import { Award, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { fetchPartnerStats, formatKoboAsCurrency } from '../utils/proSession';

/**
 * Read-only Influencer / Partner Earnings Modal opened via:
 * https://roofcalc.sijiteksolutions.com/?partner=CODE&token=SECRET_TOKEN
 */
export default function PartnerStatsModal({ partnerParams, onClose }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadStats = async () => {
    if (!partnerParams?.code || !partnerParams?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchPartnerStats(partnerParams.code, partnerParams.token);
      setStats(data);
    } catch (err) {
      setError(err?.message || 'Could not load partner earnings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerParams?.code, partnerParams?.token]);

  if (!partnerParams) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${encodeURIComponent(stats?.code || partnerParams.code)}`
      : `https://roofcalc.sijiteksolutions.com/?ref=${encodeURIComponent(stats?.code || partnerParams.code)}`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content paper-sketch-modal-card"
        style={{ maxWidth: '520px', width: '94vw', padding: '1.35rem', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Award size={20} style={{ color: '#34d399' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                RoofCalc Pro Partner Earnings
              </h3>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                Sijitek Solutions • Influencer Referral Ledger
              </div>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {loading && !stats ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            <Loader2 size={18} className="animate-spin" />
            <span>Loading live referral earnings...</span>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: '0.82rem',
            }}
          >
            {error}
          </div>
        ) : stats ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ecfdf5' }}>
                  {stats.influencerName} • <code style={{ color: '#34d399' }}>{stats.code}</code>
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.16rem 0.55rem',
                    borderRadius: '999px',
                    background: stats.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: stats.isActive ? '#34d399' : '#fca5a5',
                  }}
                >
                  {stats.isActive ? 'ACTIVE CODE' : 'PAUSED'}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#a7f3d0' }}>
                Audience gets <strong>{stats.discountPercent}% off</strong> RoofCalc Pro • You earn{' '}
                <strong>
                  {stats.commissionFlatKobo !== null
                    ? `${formatKoboAsCurrency(stats.commissionFlatKobo, stats.currency)} per Pro signup`
                    : `${stats.commissionPercent}% per Pro signup`}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginTop: '0.2rem' }}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '0.42rem 0.6rem',
                    borderRadius: '7px',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    background: 'rgba(2, 6, 23, 0.65)',
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={handleCopyShareLink}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.42rem 0.7rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                >
                  {copied ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem' }}>
              {[
                {
                  label: 'Pro Signups',
                  value: String(stats.summary?.totalSales || 0),
                  accent: '#38bdf8',
                },
                {
                  label: 'Pending Payout',
                  value: formatKoboAsCurrency(stats.summary?.pendingCommissionKobo || 0, stats.currency),
                  accent: '#fbbf24',
                },
                {
                  label: 'Total Paid Out',
                  value: formatKoboAsCurrency(stats.summary?.paidCommissionKobo || 0, stats.currency),
                  accent: '#34d399',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: card.accent }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Recent Referred Sales
                </span>
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={loadStats}
                  disabled={loading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {stats.recentConversions?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {stats.recentConversions.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.55rem 0.7rem',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.76rem',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.buyer}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {new Date(c.createdAt).toLocaleDateString()} • Paid {formatKoboAsCurrency(c.paidAmountKobo, stats.currency)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#34d399' }}>
                          +{formatKoboAsCurrency(c.commissionKobo, stats.currency)}
                        </div>
                        <div
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: c.payoutStatus === 'paid' ? '#34d399' : '#fbbf24',
                          }}
                        >
                          {c.payoutStatus}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.8rem', textAlign: 'center', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.35)' }}>
                  No referred Pro signups yet. Share your link above to start earning!
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
