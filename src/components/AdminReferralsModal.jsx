import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Check,
  Loader2,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  CheckCircle2,
  Link2,
  Award,
  Users,
  Receipt,
} from 'lucide-react';
import { callAdminReferralsApi, formatKoboAsCurrency } from '../utils/proSession';

/**
 * Sijitek Admin Dashboard (strictly restricted to sijiteksub@gmail.com both client- and server-side).
 * Includes:
 *   1. Overview — Users, Active Pro, Gross Revenue, AI Scans Used, Recent Payments & Users
 *   2. Codes & Payouts — Manage influencer codes, copy share links, mark Option A payouts paid
 *   3. Create Code — Create new influencer/promo codes with live economics preview
 */
export default function AdminReferralsModal({ isOpen, onClose, accessToken = '' }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'codes' | 'create'
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Inline payout note confirmation state
  const [payingCode, setPayingCode] = useState('');
  const [payoutNote, setPayoutNote] = useState('');

  // Create Code form state
  const [code, setCode] = useState('');
  const [influencerName, setInfluencerName] = useState('');
  const [influencerEmail, setInfluencerEmail] = useState('');
  const [discountPercent, setDiscountPercent] = useState('15');
  const [commissionType, setCommissionType] = useState('percent'); // 'percent' | 'flat'
  const [commissionPercent, setCommissionPercent] = useState('20');
  const [commissionFlatNgn, setCommissionFlatNgn] = useState('2000');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const flashToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? '' : curr)), 3500);
  };

  const loadOverview = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await callAdminReferralsApi(accessToken, { action: 'list' });
      setData(res);
    } catch (err) {
      setError(err?.message || 'Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && accessToken) {
      loadOverview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, accessToken]);

  if (!isOpen) return null;

  const baseOrigin =
    typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? window.location.origin
      : 'https://roofcalc.sijiteksolutions.com';

  const currency = data?.currency || 'NGN';
  const baseProKobo = data?.baseProAmountKobo || 1000000;

  // Live preview numbers in Create tab
  const discPctNum = Math.min(90, Math.max(0, Number(discountPercent) || 0));
  const previewDiscountKobo = Math.round((baseProKobo * discPctNum) / 100);
  const previewBuyerPaysKobo = Math.max(10000, baseProKobo - previewDiscountKobo);
  const previewInfluencerCutKobo =
    commissionType === 'flat'
      ? Math.min(previewBuyerPaysKobo, Math.max(0, Math.round((Number(commissionFlatNgn) || 0) * 100)))
      : Math.round((previewBuyerPaysKobo * Math.min(90, Math.max(0, Number(commissionPercent) || 0))) / 100);

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? '' : c)), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    setError('');
    setBusyKey('create');
    try {
      const res = await callAdminReferralsApi(accessToken, {
        action: 'create',
        code: code.trim().toUpperCase(),
        influencerName: influencerName.trim(),
        influencerEmail: influencerEmail.trim(),
        discountPercent: Number(discountPercent) || 0,
        commissionType,
        commissionPercent: Number(commissionPercent) || 0,
        commissionFlatNgn: Number(commissionFlatNgn) || 0,
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        expiresAt: expiresAt.trim() || null,
        notes: notes.trim(),
      });
      setData(res);
      setCode('');
      setInfluencerName('');
      setInfluencerEmail('');
      setMaxUses('');
      setExpiresAt('');
      setNotes('');
      setActiveTab('codes');
      flashToast(`Created code ${res.createdCode}! Copy both links below.`);
    } catch (err) {
      setError(err?.message || 'Could not create code.');
    } finally {
      setBusyKey('');
    }
  };

  const handleToggleCode = async (rc) => {
    setError('');
    setBusyKey(`toggle:${rc.code}`);
    try {
      const res = await callAdminReferralsApi(accessToken, {
        action: 'toggle',
        code: rc.code,
        isActive: !rc.isActive,
      });
      setData(res);
      flashToast(`${rc.code} ${!rc.isActive ? 'activated' : 'paused'}.`);
    } catch (err) {
      setError(err?.message || 'Could not update code status.');
    } finally {
      setBusyKey('');
    }
  };

  const handleConfirmMarkPaid = async (rc) => {
    setError('');
    setBusyKey(`paid:${rc.code}`);
    try {
      const res = await callAdminReferralsApi(accessToken, {
        action: 'mark_paid',
        code: rc.code,
        payoutNote: payoutNote.trim() || `Bank transfer — ${new Date().toLocaleDateString()}`,
      });
      setData(res);
      setPayingCode('');
      setPayoutNote('');
      flashToast(`Marked ${res.markedPaidCount || 0} sale(s) for ${rc.code} as Paid.`);
    } catch (err) {
      setError(err?.message || 'Could not mark payout as paid.');
    } finally {
      setBusyKey('');
    }
  };

  const handleDeleteCode = async (rc) => {
    setError('');
    setBusyKey(`del:${rc.code}`);
    try {
      const res = await callAdminReferralsApi(accessToken, {
        action: 'delete',
        code: rc.code,
      });
      setData(res);
      flashToast(`Deleted unused code ${rc.code}.`);
    } catch (err) {
      setError(err?.message || 'Could not delete code.');
    } finally {
      setBusyKey('');
    }
  };

  const summary = data?.summary || {
    totalUsers: 0,
    activeProUsers: 0,
    totalAiScansUsed: 0,
    totalGrossRevenueKobo: 0,
    proUpgradesCount: 0,
    scanTopupsCount: 0,
    activeCodes: 0,
    totalSales: 0,
    totalPendingKobo: 0,
    totalPaidKobo: 0,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content paper-sketch-modal-card"
        style={{ maxWidth: '680px', width: '95vw', padding: '1.25rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <ShieldCheck size={20} style={{ color: '#34d399' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Sijitek Admin Dashboard
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                RoofCalc Pro • Revenue, Users, AI Usage &amp; Influencer Payouts
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={loadOverview}
              disabled={loading}
              style={{ padding: '5px 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Refresh live data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.45rem', flexShrink: 0 }}>
          {[
            {
              label: 'Gross Revenue',
              value: formatKoboAsCurrency(summary.totalGrossRevenueKobo, currency),
              sub: `${summary.proUpgradesCount} Pro • ${summary.scanTopupsCount} Top-ups`,
              color: '#34d399',
            },
            {
              label: 'Users / Pro',
              value: `${summary.totalUsers} / ${summary.activeProUsers}`,
              sub: `${summary.totalAiScansUsed} AI scans run`,
              color: '#38bdf8',
            },
            {
              label: 'Pending Payouts',
              value: formatKoboAsCurrency(summary.totalPendingKobo, currency),
              sub: `${summary.totalSales} referred sales`,
              color: '#fbbf24',
            },
            {
              label: 'Paid Out',
              value: formatKoboAsCurrency(summary.totalPaidKobo, currency),
              sub: `${summary.activeCodes} active codes`,
              color: '#a78bfa',
            },
          ].map((k) => (
            <div
              key={k.label}
              style={{
                padding: '0.58rem 0.65rem',
                borderRadius: '9px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{k.label}</div>
              <div style={{ fontSize: '0.94rem', fontWeight: 800, color: k.color, marginTop: '2px' }}>{k.value}</div>
              <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '1px' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* 3-Tab Navigation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', background: 'rgba(2, 6, 23, 0.5)', padding: '4px', borderRadius: '9px', flexShrink: 0 }}>
          {[
            { id: 'overview', label: 'Overview', activeBg: '#38bdf8', activeColor: '#0f172a' },
            { id: 'codes', label: `Codes & Payouts (${data?.codes?.length || 0})`, activeBg: '#0ea5e9', activeColor: '#ffffff' },
            { id: 'create', label: '+ Create Code', activeBg: '#10b981', activeColor: '#052e16' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '7px 6px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: active ? tab.activeBg : 'transparent',
                  color: active ? tab.activeColor : '#94a3b8',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {toast && (
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(52, 211, 153, 0.45)', color: '#6ee7b7', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <CheckCircle2 size={14} />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '0.78rem', flexShrink: 0 }}>
            {error}
          </div>
        )}

        {/* Scrollable Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '2px' }}>
          {activeTab === 'overview' ? (
            loading && !data ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '1.5rem 0', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                <Loader2 size={18} className="animate-spin" />
                <span>Loading dashboard metrics...</span>
              </div>
            ) : (
              <>
                {/* Recent Payments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Receipt size={14} style={{ color: '#34d399' }} />
                    <span>Recent Payments ({data?.recentTransactions?.length || 0})</span>
                  </div>
                  {data?.recentTransactions?.length ? (
                    data.recentTransactions.slice(0, 12).map((tx) => (
                      <div
                        key={tx.paystack_reference}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#f8fafc', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.email || 'Customer'}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {tx.purchase_type === 'scan_topup' ? `AI Scan Top-Up (+${tx.scans_added} scans)` : 'RoofCalc Pro Upgrade'}
                            {tx.referral_code ? ` • Code ${tx.referral_code}` : ''} • {new Date(tx.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, color: '#34d399' }}>
                            {formatKoboAsCurrency(tx.paid_amount_kobo, currency)}
                          </div>
                          {Number(tx.discount_kobo) > 0 && (
                            <div style={{ fontSize: '0.66rem', color: '#fbbf24' }}>
                              -{formatKoboAsCurrency(tx.discount_kobo, currency)} disc
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.4)', fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No completed payments recorded yet.
                    </div>
                  )}
                </div>

                {/* Registered Users */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} style={{ color: '#38bdf8' }} />
                    <span>Registered Accounts ({data?.recentUsers?.length || 0})</span>
                  </div>
                  {data?.recentUsers?.length ? (
                    data.recentUsers.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.55)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#f8fafc', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </div>
                          <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                            AI Scans: {u.isAdmin ? `${u.scansUsed} used (Unlimited)` : `${u.scansUsed} / ${u.scansLimit}`}
                            {u.referredByCode ? ` • Ref: ${u.referredByCode}` : ''}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '999px',
                            flexShrink: 0,
                            background: u.isAdmin
                              ? 'rgba(16, 185, 129, 0.2)'
                              : u.isPro
                              ? 'rgba(245, 158, 11, 0.18)'
                              : 'rgba(148, 163, 184, 0.16)',
                            color: u.isAdmin ? '#34d399' : u.isPro ? '#fbbf24' : '#cbd5e1',
                          }}
                        >
                          {u.isAdmin ? 'ADMIN' : u.isPro ? 'PRO' : 'FREE'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.4)', fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No users found yet.
                    </div>
                  )}
                </div>
              </>
            )
          ) : activeTab === 'codes' ? (
            loading && !data ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '1.5rem 0', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                <Loader2 size={18} className="animate-spin" />
                <span>Loading codes &amp; payout ledger...</span>
              </div>
            ) : !data?.codes?.length ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', background: 'rgba(15, 23, 42, 0.45)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                No referral codes yet. Click <strong>+ Create Code</strong> to onboard your first influencer or promo campaign.
              </div>
            ) : (
              data.codes.map((rc) => {
                const promoLink = `${baseOrigin}/?ref=${encodeURIComponent(rc.code)}`;
                const partnerLink = `${baseOrigin}/?partner=${encodeURIComponent(rc.code)}&token=${encodeURIComponent(rc.partnerToken)}`;
                const isPaying = payingCode === rc.code;
                const cutLabel =
                  rc.commissionFlatKobo !== null
                    ? `${formatKoboAsCurrency(rc.commissionFlatKobo, currency)} flat/sale`
                    : `${rc.commissionPercent}% commission`;

                return (
                  <div
                    key={rc.code}
                    style={{
                      padding: '0.8rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: `1px solid ${rc.pendingCommissionKobo > 0 ? 'rgba(245, 158, 11, 0.45)' : 'var(--border-color)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <code style={{ fontSize: '0.92rem', fontWeight: 900, color: '#38bdf8', background: 'rgba(14, 165, 233, 0.14)', padding: '2px 7px', borderRadius: '6px' }}>
                            {rc.code}
                          </code>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
                            {rc.influencerName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '999px',
                              background: rc.isActive ? 'rgba(16, 185, 129, 0.18)' : 'rgba(148, 163, 184, 0.18)',
                              color: rc.isActive ? '#34d399' : '#94a3b8',
                            }}
                          >
                            {rc.isActive ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          Buyer gets <strong>{rc.discountPercent}% off</strong> • Influencer earns <strong>{cutLabel}</strong>
                          {rc.influencerEmail ? ` • ${rc.influencerEmail}` : ''}
                          {rc.maxUses ? ` • Limit ${rc.usesCount}/${rc.maxUses}` : ''}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.74rem' }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 700 }}>
                          {rc.totalSales} {rc.totalSales === 1 ? 'sale' : 'sales'}
                        </div>
                        <div style={{ color: rc.pendingCommissionKobo > 0 ? '#fbbf24' : '#94a3b8', fontWeight: 800 }}>
                          Pending: {formatKoboAsCurrency(rc.pendingCommissionKobo, currency)}
                        </div>
                        {rc.paidCommissionKobo > 0 && (
                          <div style={{ color: '#34d399', fontSize: '0.7rem' }}>
                            Paid: {formatKoboAsCurrency(rc.paidCommissionKobo, currency)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => handleCopy(`promo:${rc.code}`, promoLink)}
                        style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedId === `promo:${rc.code}` ? <Check size={12} style={{ color: '#34d399' }} /> : <Link2 size={12} />}
                        {copiedId === `promo:${rc.code}` ? 'Copied Promo Link!' : 'Copy Promo Link'}
                      </button>

                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => handleCopy(`partner:${rc.code}`, partnerLink)}
                        style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Private live earnings tracker link for the influencer"
                      >
                        {copiedId === `partner:${rc.code}` ? <Check size={12} style={{ color: '#34d399' }} /> : <Award size={12} />}
                        {copiedId === `partner:${rc.code}` ? 'Copied Earnings Link!' : 'Copy Partner Earnings Link'}
                      </button>

                      {rc.pendingCommissionKobo > 0 && !isPaying && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayingCode(rc.code);
                            setPayoutNote('');
                          }}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '7px',
                            border: 'none',
                            background: '#10b981',
                            color: '#052e16',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Mark Paid ({formatKoboAsCurrency(rc.pendingCommissionKobo, currency)})
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => handleToggleCode(rc)}
                        disabled={busyKey === `toggle:${rc.code}`}
                        style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {rc.isActive ? <Pause size={12} /> : <Play size={12} />}
                        {rc.isActive ? 'Pause' : 'Resume'}
                      </button>

                      {rc.totalSales === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCode(rc)}
                          disabled={busyKey === `del:${rc.code}`}
                          title="Delete unused code"
                          style={{
                            padding: '4px 7px',
                            borderRadius: '7px',
                            background: 'rgba(239, 68, 68, 0.14)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#fca5a5',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Inline Mark Paid Confirmation */}
                    {isPaying && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #1e293b' }}>
                        <input
                          type="text"
                          value={payoutNote}
                          onChange={(e) => setPayoutNote(e.target.value)}
                          placeholder="Transfer note (e.g. GTBank transfer Nov 22)"
                          style={{ flex: '1 1 180px', padding: '5px 8px', fontSize: '0.75rem', background: '#090e1a' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmMarkPaid(rc)}
                          disabled={busyKey === `paid:${rc.code}`}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '7px',
                            border: 'none',
                            background: '#10b981',
                            color: '#052e16',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {busyKey === `paid:${rc.code}` ? 'Saving...' : 'Confirm Paid'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary-action"
                          onClick={() => setPayingCode('')}
                          style={{ padding: '5px 8px', fontSize: '0.74rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* Create New Code Form */
            <form onSubmit={handleCreateCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Promo / Referral Code *</span>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="e.g. CHUKA15"
                    style={{ padding: '7px 9px', fontSize: '0.84rem', textTransform: 'uppercase', fontWeight: 700 }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Influencer / Campaign Name *</span>
                  <input
                    type="text"
                    required
                    value={influencerName}
                    onChange={(e) => setInfluencerName(e.target.value)}
                    placeholder="e.g. Engr. Chuka"
                    style={{ padding: '7px 9px', fontSize: '0.84rem' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: '0.6rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Influencer Email (optional — blocks self-referral)</span>
                  <input
                    type="email"
                    value={influencerEmail}
                    onChange={(e) => setInfluencerEmail(e.target.value)}
                    placeholder="chuka@gmail.com"
                    style={{ padding: '7px 9px', fontSize: '0.84rem' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Buyer Discount (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    step="1"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    style={{ padding: '7px 9px', fontSize: '0.84rem', fontWeight: 700 }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Influencer Commission Type</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    {[
                      { id: 'percent', label: 'Percentage (%)' },
                      { id: 'flat', label: `Flat (${currency})` },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCommissionType(opt.id)}
                        style={{
                          padding: '7px 6px',
                          borderRadius: '7px',
                          border: `1px solid ${commissionType === opt.id ? '#10b981' : 'var(--border-color)'}`,
                          background: commissionType === opt.id ? 'rgba(16, 185, 129, 0.16)' : 'rgba(2, 6, 23, 0.45)',
                          color: commissionType === opt.id ? '#34d399' : '#94a3b8',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {commissionType === 'percent' ? (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Influencer Cut (% of paid amount)</span>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      step="1"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(e.target.value)}
                      style={{ padding: '7px 9px', fontSize: '0.84rem', fontWeight: 700 }}
                    />
                  </label>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Flat Cut per Pro Signup ({currency})</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={commissionFlatNgn}
                      onChange={(e) => setCommissionFlatNgn(e.target.value)}
                      style={{ padding: '7px 9px', fontSize: '0.84rem', fontWeight: 700 }}
                    />
                  </label>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Max Uses (blank = unlimited)</span>
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Unlimited"
                    style={{ padding: '7px 9px', fontSize: '0.82rem' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Expiry Date (optional)</span>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    style={{ padding: '7px 9px', fontSize: '0.82rem' }}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. TikTok builder campaign, GTBank payout monthly"
                  style={{ padding: '7px 9px', fontSize: '0.82rem' }}
                />
              </label>

              {/* Live Economics Preview */}
              <div
                style={{
                  padding: '0.65rem 0.8rem',
                  borderRadius: '9px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  fontSize: '0.76rem',
                  color: '#a7f3d0',
                  lineHeight: 1.5,
                }}
              >
                <strong>Live Preview (on {formatKoboAsCurrency(baseProKobo, currency)} Pro):</strong>{' '}
                Buyer pays <strong>{formatKoboAsCurrency(previewBuyerPaysKobo, currency)}</strong> (saves{' '}
                {formatKoboAsCurrency(previewDiscountKobo, currency)}) • Influencer earns{' '}
                <strong>{formatKoboAsCurrency(previewInfluencerCutKobo, currency)}</strong> per Pro signup • You keep{' '}
                <strong>{formatKoboAsCurrency(Math.max(0, previewBuyerPaysKobo - previewInfluencerCutKobo), currency)}</strong> before Paystack/AI fees.
              </div>

              <button
                type="submit"
                className="btn-primary-action"
                disabled={busyKey === 'create' || !code.trim() || !influencerName.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {busyKey === 'create' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                <span>Create Referral Code</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
