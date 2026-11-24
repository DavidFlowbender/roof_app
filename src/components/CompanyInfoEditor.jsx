import React from 'react';
import { Building2, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { DEFAULT_CONTRACTOR_INFO } from '../utils/proSession';

/**
 * Reusable Pro-only Company Info & PDF Logo Branding editor.
 * Used inside Mobile "Company Info & Prices" -> Company tab and Desktop "4. Company Info" tab.
 */
export default function CompanyInfoEditor({
  contractorInfo = DEFAULT_CONTRACTOR_INFO,
  setContractorInfo,
  onUploadLogo,
  logoUploadError = '',
  setLogoUploadError,
  compact = false,
}) {
  const info = { ...DEFAULT_CONTRACTOR_INFO, ...(contractorInfo || {}) };

  const updateField = (field, value) => {
    if (!setContractorInfo) return;
    setContractorInfo((prev) => ({ ...DEFAULT_CONTRACTOR_INFO, ...(prev || {}), [field]: value }));
  };

  const inputStyle = {
    width: '100%',
    background: '#090e1a',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: compact ? '8px 10px' : '9px 12px',
    fontSize: compact ? '12.5px' : '13px',
    fontWeight: 600,
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
    marginBottom: '4px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '10px' : '14px' }}>
      {/* Logo Upload Card */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: compact ? '10px 12px' : '14px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            {info.logoDataUrl ? (
              <div
                style={{
                  width: compact ? '56px' : '68px',
                  height: compact ? '40px' : '46px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <img
                  src={info.logoDataUrl}
                  alt="Company Logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: compact ? '42px' : '48px',
                  height: compact ? '42px' : '48px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px dashed rgba(16, 185, 129, 0.5)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: compact ? '12.5px' : '13.5px', fontWeight: 800, color: '#f8fafc' }}>
                {info.logoDataUrl ? 'Company Logo Saved' : 'Upload Your Company Logo'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Appears in the top-left header of every exported PDF quote (PNG, JPG, SVG).
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '8px',
                background: 'rgba(14, 165, 233, 0.16)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                color: '#38bdf8',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{info.logoDataUrl ? 'Change Logo' : 'Upload Logo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={onUploadLogo}
                style={{ display: 'none' }}
              />
            </label>
            {info.logoDataUrl && (
              <button
                type="button"
                onClick={() => {
                  if (setLogoUploadError) setLogoUploadError('');
                  updateField('logoDataUrl', '');
                }}
                title="Remove company logo"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  cursor: 'pointer',
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {logoUploadError && (
          <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#f87171' }}>{logoUploadError}</div>
        )}
      </div>

      {/* Company Details Form */}
      <div
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: compact ? '12px' : '16px',
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : '1fr 1fr',
          gap: compact ? '10px' : '12px',
        }}
      >
        <div>
          <label style={labelStyle}>Contractor Company Name</label>
          <input
            type="text"
            placeholder="e.g. Apex Roofing & Engineering Ltd"
            value={info.name}
            onChange={(e) => updateField('name', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Contractor Phone Number</label>
          <input
            type="text"
            placeholder="e.g. +234 803 000 0000"
            value={info.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Company Email</label>
          <input
            type="email"
            placeholder="e.g. quotes@yourcompany.com"
            value={info.email}
            onChange={(e) => updateField('email', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Office Address / City</label>
          <input
            type="text"
            placeholder="e.g. Ikeja, Lagos, Nigeria"
            value={info.address}
            onChange={(e) => updateField('address', e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11.5px',
          color: '#34d399',
          padding: '0 2px',
        }}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Set once — saved permanently to your Pro account and applied automatically to every exported PDF.</span>
      </div>
    </div>
  );
}
