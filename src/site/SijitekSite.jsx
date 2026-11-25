import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Monitor,
  Ruler,
  Share,
  Smartphone,
  TabletSmartphone,
  X,
} from 'lucide-react';
import {
  AUDIENCE_GROUPS,
  ENGINEERING_PILLARS,
  getSijitekProducts,
} from './productsData';
import './SijitekSite.css';

/**
 * Hand-crafted architectural drafting plate SVG (no neon, no generic gradients).
 * Shows an orthographic hip roof plan + structural elevation callouts.
 */
function ArchitecturalRoofPlate() {
  return (
    <div className="sjk-blueprint-sheet sjk-hero-plate-anim" aria-label="Architectural Roof Drafting Preview">
      <div className="sjk-sheet-topbar sjk-mono">
        <span>SHEET A-01 // ROOF GEOMETRY &amp; BOQ</span>
        <span>SCALE 1:100</span>
      </div>

      <div className="sjk-sheet-body">
        <svg viewBox="0 0 460 280" width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label="Architectural Hip Roof Plan and Elevation">
          <defs>
            <pattern id="sjk-draft-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e0d4" strokeWidth="0.7" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="460" height="280" fill="url(#sjk-draft-grid)" />

          {/* TOP-LEFT: Tiny Motion Cartoon of Worker with Safety Helmet Building a Roof */}
          <text x="18" y="18" fill="#6c757d" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.8" className="sjk-svg-fade" style={{ '--sjk-delay': '0.2s' }}>
            01. ON-SITE CONSTRUCTION
          </text>

          <g aria-label="Animated cartoon worker wearing a safety helmet working on a building roof">
            {/* Gentle drifting clouds */}
            <g className="sjk-cloud-drift" opacity="0.85">
              <path d="M 30 33 Q 34 27 40 30 Q 45 26 50 31 Q 54 31 54 35 L 28 35 Q 26 33 30 33 Z" fill="#ffffff" stroke="#c2bbb0" strokeWidth="0.9" />
              <path d="M 185 29 Q 189 24 194 27 Q 199 24 203 28 L 204 31 L 183 31 Z" fill="#ffffff" stroke="#c2bbb0" strokeWidth="0.8" />
            </g>

            {/* Site Ground Line */}
            <line x1="16" y1="112" x2="224" y2="112" stroke="#14191f" strokeWidth="1.4" />

            {/* Building Structure Under Construction */}
            <rect x="28" y="64" width="118" height="48" fill="#f1eee6" stroke="#14191f" strokeWidth="1.4" />
            {/* Subtle blockwork masonry courses */}
            <line x1="28" y1="76" x2="146" y2="76" stroke="#dcd6c8" strokeWidth="0.7" />
            <line x1="28" y1="88" x2="146" y2="88" stroke="#dcd6c8" strokeWidth="0.7" />
            <line x1="28" y1="100" x2="146" y2="100" stroke="#dcd6c8" strokeWidth="0.7" />
            {/* Framed Door & Window */}
            <rect x="42" y="84" width="18" height="28" rx="1" fill="#dcd6c8" stroke="#14191f" strokeWidth="1.1" />
            <rect x="76" y="76" width="24" height="18" rx="1" fill="#ffffff" stroke="#14191f" strokeWidth="1.1" />
            <line x1="88" y1="76" x2="88" y2="94" stroke="#14191f" strokeWidth="0.9" />
            <line x1="76" y1="85" x2="100" y2="85" stroke="#14191f" strokeWidth="0.9" />

            {/* Concrete Parapet Ledge */}
            <rect x="22" y="59" width="130" height="5" rx="1" fill="#d9d4c7" stroke="#14191f" strokeWidth="1.2" />

            {/* Timber Roof Trusses Being Built */}
            <polygon points="24,59 87,30 150,59" fill="#e8e2d5" fillOpacity="0.65" stroke="#14191f" strokeWidth="1.4" />
            {/* Left finished tiled slope accent */}
            <polygon points="24,59 87,30 87,59" fill="#b84a27" fillOpacity="0.22" />
            {/* Exposed Kingpost & Rafters */}
            <line x1="87" y1="30" x2="87" y2="59" stroke="#8c5327" strokeWidth="2.2" />
            <line x1="87" y1="59" x2="56" y2="44" stroke="#8c5327" strokeWidth="1.6" />
            <line x1="87" y1="59" x2="118" y2="44" stroke="#8c5327" strokeWidth="1.6" />
            {/* Active timber rafter beam being nailed by the worker */}
            <line x1="87" y1="30" x2="152" y2="60" stroke="#b84a27" strokeWidth="2.6" strokeLinecap="round" />

            {/* Timber Scaffold Platform on Right */}
            <line x1="160" y1="68" x2="160" y2="112" stroke="#525b65" strokeWidth="2" />
            <line x1="208" y1="68" x2="208" y2="112" stroke="#525b65" strokeWidth="2" />
            <line x1="160" y1="108" x2="208" y2="72" stroke="#7c8794" strokeWidth="1" />
            <line x1="160" y1="72" x2="208" y2="108" stroke="#7c8794" strokeWidth="1" />
            <rect x="154" y="65" width="60" height="4.5" rx="1.5" fill="#9c6b3b" stroke="#14191f" strokeWidth="1.1" />

            {/* TINY ANIMATED CARTOON WORKER WITH SAFETY HELMET */}
            <g transform="translate(166, 26)">
              {/* Legs & Work Boots */}
              <rect x="11" y="27" width="5" height="10" rx="1.5" fill="#1e293b" stroke="#14191f" strokeWidth="0.9" />
              <rect x="18" y="27" width="5" height="10" rx="1.5" fill="#1e293b" stroke="#14191f" strokeWidth="0.9" />
              <rect x="9" y="36" width="7.5" height="3.2" rx="1.2" fill="#14191f" />
              <rect x="17.5" y="36" width="7.5" height="3.2" rx="1.2" fill="#14191f" />

              {/* Torso & High-Vis Safety Vest */}
              <rect x="9.5" y="14" width="15" height="14.5" rx="4" fill="#19473a" stroke="#14191f" strokeWidth="1" />
              {/* High-vis orange/yellow vest panels & reflective bands */}
              <path d="M 10.5 15 L 15.5 15 L 15.5 28 L 10.5 28 Z" fill="#f59e0b" />
              <path d="M 18.5 15 L 23.5 15 L 23.5 28 L 18.5 28 Z" fill="#f59e0b" />
              <line x1="10.2" y1="22.5" x2="23.8" y2="22.5" stroke="#ffffff" strokeWidth="1.6" />
              <line x1="10.2" y1="25.5" x2="23.8" y2="25.5" stroke="#ffffff" strokeWidth="1.2" />

              {/* Animated Hammering Arm (Left side facing the roof beam) */}
              <g className="sjk-worker-arm">
                {/* Arm sleeve */}
                <path d="M 11 17 L -2 21" stroke="#19473a" strokeWidth="4.2" strokeLinecap="round" />
                {/* Hand */}
                <circle cx="-3" cy="21.3" r="2.3" fill="#8d5524" stroke="#14191f" strokeWidth="0.8" />
                {/* Hammer Handle */}
                <line x1="-3.5" y1="21" x2="-11" y2="12" stroke="#9c6b3b" strokeWidth="2.1" strokeLinecap="round" />
                {/* Hammer Steel Head */}
                <path d="M -14.5 14 L -8 9.2 L -6.5 11.2 L -13 16 Z" fill="#334155" stroke="#14191f" strokeWidth="0.8" />
              </g>

              {/* Back resting arm */}
              <path d="M 23.5 17.5 L 27.5 24" stroke="#19473a" strokeWidth="3.8" strokeLinecap="round" />
              <circle cx="27.8" cy="24.5" r="2" fill="#8d5524" stroke="#14191f" strokeWidth="0.7" />

              {/* Head + Bright Safety Helmet (with gentle working bob) */}
              <g className="sjk-worker-head">
                {/* Face */}
                <circle cx="17" cy="9.2" r="5.6" fill="#8d5524" stroke="#14191f" strokeWidth="1" />
                {/* Cheerful eye & smile looking left at roof */}
                <circle cx="14.6" cy="8.8" r="0.95" fill="#14191f" />
                <path d="M 13.5 11.3 Q 15 12.6 16.8 11.5" fill="none" stroke="#14191f" strokeWidth="0.9" strokeLinecap="round" />
                {/* Safety Helmet Dome */}
                <path d="M 10.6 7.8 C 10.6 1.6, 23.4 1.6, 23.4 7.8 Z" fill="#facc15" stroke="#14191f" strokeWidth="1.15" />
                {/* Helmet Center Ridge */}
                <path d="M 15.6 2.5 L 18.4 2.5 L 18.8 7.6 L 15.2 7.6 Z" fill="#eab308" stroke="#14191f" strokeWidth="0.7" />
                {/* Safety Helmet Brim */}
                <path d="M 8.6 7.8 L 24.4 7.8" stroke="#14191f" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M 9 7.5 L 24 7.5" stroke="#facc15" strokeWidth="1" strokeLinecap="round" />
              </g>
            </g>

            {/* Tiny Impact Tap Sparks where hammer meets roof rafter */}
            <g className="sjk-tap-spark" stroke="#b84a27" strokeWidth="1.4" strokeLinecap="round">
              <line x1="149" y1="53" x2="145" y2="49" />
              <line x1="152" y1="51" x2="152" y2="46" />
              <line x1="155" y1="53" x2="159" y2="49" />
            </g>
          </g>

          {/* TOP-RIGHT: Quick Schedule Readout */}
          <g transform="translate(238, 16)" className="sjk-svg-fade" style={{ '--sjk-delay': '0.68s' }}>
            <rect x="0" y="0" width="200" height="92" rx="4" fill="#ffffff" stroke="#c2bbb0" strokeWidth="1" />
            <line x1="0" y1="24" x2="200" y2="24" stroke="#d9d4c7" strokeWidth="1" />
            <text x="10" y="15" fill="#14191f" fontSize="8.5" fontWeight="600" fontFamily="IBM Plex Mono, monospace">
              LIVE SCHEDULE SUMMARY
            </text>
            <text x="10" y="42" fill="#6c757d" fontSize="8.5" fontFamily="IBM Plex Mono, monospace">ROOF AREA (+10%)</text>
            <text x="190" y="42" textAnchor="end" fill="#19473a" fontSize="9.5" fontWeight="600" fontFamily="IBM Plex Mono, monospace">77.00 m²</text>
            <line x1="10" y1="50" x2="190" y2="50" stroke="#efece4" strokeWidth="1" />
            <text x="10" y="64" fill="#6c757d" fontSize="8.5" fontFamily="IBM Plex Mono, monospace">RIDGE &amp; HIPS</text>
            <text x="190" y="64" textAnchor="end" fill="#14191f" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono, monospace">24.30 m</text>
            <line x1="10" y1="72" x2="190" y2="72" stroke="#efece4" strokeWidth="1" />
            <text x="10" y="85" fill="#6c757d" fontSize="8.5" fontFamily="IBM Plex Mono, monospace">WC COLLECTOR RUN</text>
            <text x="190" y="85" textAnchor="end" fill="#b84a27" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono, monospace">31.00 m</text>
          </g>

          {/* BOTTOM: Architectural Roof Plan */}
          <text x="24" y="138" fill="#6c757d" fontSize="9" fontFamily="IBM Plex Mono, monospace" letterSpacing="1" className="sjk-svg-fade" style={{ '--sjk-delay': '0.55s' }}>
            02. ROOF PLAN — FOUNDATION (+0.50m PARAPET ALLOWANCE)
          </text>

          {/* Outer Parapet / Eave Boundary */}
          <rect x="64" y="152" width="332" height="94" fill="#ffffff" stroke="#14191f" strokeWidth="1.8" className="sjk-draw" style={{ '--sjk-len': 860, '--sjk-dur': '0.95s', '--sjk-delay': '0.6s' }} />
          {/* Inner Dashed Wall Footprint */}
          <rect x="78" y="166" width="304" height="66" fill="#f6f4ef" stroke="#6c757d" strokeWidth="1.1" strokeDasharray="4 3" className="sjk-svg-fade" style={{ '--sjk-delay': '0.92s' }} />

          {/* Hip & Ridge Geometry — drafts from corners into apex */}
          <line x1="64" y1="152" x2="124" y2="199" stroke="#b84a27" strokeWidth="1.5" className="sjk-draw" style={{ '--sjk-len': 80, '--sjk-dur': '0.45s', '--sjk-delay': '0.95s' }} />
          <line x1="64" y1="246" x2="124" y2="199" stroke="#b84a27" strokeWidth="1.5" className="sjk-draw" style={{ '--sjk-len': 80, '--sjk-dur': '0.45s', '--sjk-delay': '1.0s' }} />
          <line x1="396" y1="152" x2="336" y2="199" stroke="#b84a27" strokeWidth="1.5" className="sjk-draw" style={{ '--sjk-len': 80, '--sjk-dur': '0.45s', '--sjk-delay': '1.05s' }} />
          <line x1="396" y1="246" x2="336" y2="199" stroke="#b84a27" strokeWidth="1.5" className="sjk-draw" style={{ '--sjk-len': 80, '--sjk-dur': '0.45s', '--sjk-delay': '1.1s' }} />
          <line x1="124" y1="199" x2="336" y2="199" stroke="#19473a" strokeWidth="2.2" className="sjk-draw" style={{ '--sjk-len': 220, '--sjk-dur': '0.6s', '--sjk-delay': '1.15s' }} />

          {/* Corner Nodes */}
          <circle cx="78" cy="166" r="3" fill="#ffffff" stroke="#14191f" strokeWidth="1.3" className="sjk-svg-node" style={{ '--sjk-delay': '1.02s' }} />
          <circle cx="382" cy="166" r="3" fill="#ffffff" stroke="#14191f" strokeWidth="1.3" className="sjk-svg-node" style={{ '--sjk-delay': '1.08s' }} />
          <circle cx="382" cy="232" r="3" fill="#ffffff" stroke="#14191f" strokeWidth="1.3" className="sjk-svg-node" style={{ '--sjk-delay': '1.14s' }} />
          <circle cx="78" cy="232" r="3" fill="#ffffff" stroke="#14191f" strokeWidth="1.3" className="sjk-svg-node" style={{ '--sjk-delay': '1.2s' }} />

          {/* Dimension Lines */}
          <g className="sjk-svg-fade" style={{ '--sjk-delay': '1.25s' }}>
            <line x1="64" y1="262" x2="396" y2="262" stroke="#434d56" strokeWidth="0.9" />
            <line x1="64" y1="257" x2="64" y2="267" stroke="#434d56" strokeWidth="0.9" />
            <line x1="396" y1="257" x2="396" y2="267" stroke="#434d56" strokeWidth="0.9" />
            <rect x="195" y="254" width="70" height="16" fill="#fbfaf7" />
            <text x="230" y="265" textAnchor="middle" fill="#14191f" fontSize="9.5" fontWeight="600" fontFamily="IBM Plex Mono, monospace">
              11.00 m
            </text>

            <line x1="414" y1="152" x2="414" y2="246" stroke="#434d56" strokeWidth="0.9" />
            <line x1="409" y1="152" x2="419" y2="152" stroke="#434d56" strokeWidth="0.9" />
            <line x1="409" y1="246" x2="419" y2="246" stroke="#434d56" strokeWidth="0.9" />
            <text x="427" y="202" textAnchor="middle" fill="#14191f" fontSize="9.5" fontWeight="600" fontFamily="IBM Plex Mono, monospace" transform="rotate(90, 427, 202)">
              4.50 m
            </text>

            {/* Ridge Badge */}
            <rect x="180" y="189" width="100" height="20" rx="3" fill="#151c22" />
            <text x="230" y="202" textAnchor="middle" fill="#f6f4ef" fontSize="9" fontWeight="600" fontFamily="IBM Plex Mono, monospace">
              RIDGE · 6.50 m
            </text>
          </g>
        </svg>
      </div>

      <div className="sjk-sheet-titleblock sjk-mono">
        <div className="sjk-sheet-cell">
          <span className="sjk-sheet-cell-lbl">Studio</span>
          <span className="sjk-sheet-cell-val">Sijitek Solutions</span>
        </div>
        <div className="sjk-sheet-cell">
          <span className="sjk-sheet-cell-lbl">Discipline</span>
          <span className="sjk-sheet-cell-val">Construction Tech</span>
        </div>
        <div className="sjk-sheet-cell">
          <span className="sjk-sheet-cell-lbl">Flagship Tool</span>
          <span className="sjk-sheet-cell-val">RoofCalc Pro</span>
        </div>
      </div>
    </div>
  );
}

export default function SijitekSite() {
  const products = getSijitekProducts();
  const primaryProduct = products[0];

  const [guideModal, setGuideModal] = useState(null); // { product, device } | null
  const [copiedId, setCopiedId] = useState('');
  const [productsMenuOpen, setProductsMenuOpen] = useState(false);
  const productsMenuRef = useRef(null);

  useEffect(() => {
    if (!productsMenuOpen) return;
    const onOutside = (e) => {
      if (productsMenuRef.current && !productsMenuRef.current.contains(e.target)) {
        setProductsMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setProductsMenuOpen(false);
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('touchstart', onOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('touchstart', onOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [productsMenuOpen]);

  useEffect(() => {
    document.title = 'Sijitek Solutions — Practical Solutions for Engineering & Construction';

    // Lightweight scroll-reveal observer for architectural sections & cards
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.sjk-reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
    );

    const targets = document.querySelectorAll('.sjk-reveal');
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const handleCopyLink = (product) => {
    const urlToCopy = product?.shareUrl || 'https://roofcalc.sijiteksolutions.com';
    navigator.clipboard?.writeText(urlToCopy).catch(() => {});
    setCopiedId(product.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === product.id ? '' : curr));
    }, 2500);
  };

  const renderDeviceIcon = (deviceId) => {
    if (deviceId === 'desktop') return <Monitor className="w-4 h-4" style={{ color: '#19473a' }} />;
    if (deviceId === 'android') return <Smartphone className="w-4 h-4" style={{ color: '#b84a27' }} />;
    return <TabletSmartphone className="w-4 h-4" style={{ color: '#14191f' }} />;
  };

  return (
    <div className="sjk-page">
      {/* Header */}
      <header className="sjk-header">
        <div className="sjk-container sjk-header-inner">
          <a href="#top" className="sjk-brand">
            <span className="sjk-brand-mark">S</span>
            <span>
              <span className="sjk-brand-name">Sijitek Solutions</span>
              <span className="sjk-brand-sub sjk-mono">Engineering &amp; Construction</span>
            </span>
          </a>

          <nav className="sjk-nav" aria-label="Primary Navigation">
            <a href="#who-it-serves" className="sjk-nav-link">
              Who We Serve
            </a>

            {/* Products Hover / Tap Dropdown */}
            <div
              ref={productsMenuRef}
              className={`sjk-nav-dropdown ${productsMenuOpen ? 'is-open' : ''}`}
              onMouseEnter={() => setProductsMenuOpen(true)}
              onMouseLeave={() => setProductsMenuOpen(false)}
            >
              <button
                type="button"
                className="sjk-nav-link sjk-nav-dropdown-trigger"
                aria-expanded={productsMenuOpen}
                aria-haspopup="menu"
                onClick={() => setProductsMenuOpen((v) => !v)}
              >
                <span>Products</span>
                <ChevronDown className="w-3.5 h-3.5 sjk-nav-chevron" />
              </button>

              <div className="sjk-nav-dropdown-bridge" role="menu">
                <div className="sjk-nav-dropdown-panel">
                  <div className="sjk-nav-dropdown-head sjk-mono">
                    <span>SIJITEK PRODUCTS</span>
                    <span>{String(products.length).padStart(2, '0')} LIVE</span>
                  </div>

                  <div className="sjk-nav-dropdown-list">
                    {products.map((product) => (
                      <a
                        key={product.id}
                        href={product.launchUrl}
                        role="menuitem"
                        className="sjk-nav-product-item"
                        onClick={() => setProductsMenuOpen(false)}
                      >
                        <div className="sjk-nav-product-top">
                          <span className="sjk-nav-product-name">{product.name}</span>
                          <span className="sjk-nav-product-badge sjk-mono">
                            <span className="sjk-nav-product-dot" />
                            {product.statusLabel}
                          </span>
                        </div>
                        <span className="sjk-nav-product-cat">{product.category}</span>
                        <span className="sjk-nav-product-launch">
                          <span>Launch {product.name}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                      </a>
                    ))}
                  </div>

                  <a
                    href="#products"
                    className="sjk-nav-dropdown-footer"
                    onClick={() => setProductsMenuOpen(false)}
                  >
                    <span>Explore specs &amp; phone install guides</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <a href="#approach" className="sjk-nav-link">
              Approach
            </a>
          </nav>
        </div>
      </header>

      {/* Slim Animated Construction Tractor Strip Across Top of Page */}
      <div className="sjk-tractor-track" aria-hidden="true">
        <div className="sjk-tractor-runner">
          <svg viewBox="0 0 110 46" width="92" height="38" style={{ display: 'block', overflow: 'visible' }}>
            {/* Exhaust Smoke Puffs */}
            <circle cx="58" cy="10" r="2.8" fill="#c2bbb0" className="sjk-puff-1" />
            <circle cx="55" cy="7" r="2.2" fill="#d9d4c7" className="sjk-puff-2" />

            {/* Tractor Chassis & Loader (subtle engine bounce) */}
            <g className="sjk-tractor-body">
              {/* Vertical Exhaust Stack */}
              <path d="M 60 22 L 60 12 L 57.5 10" fill="none" stroke="#14191f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

              {/* Cab Roll-Cage & Canopy */}
              <path d="M 22 24 L 24 10 L 45 10 L 48 24" fill="#fbfaf7" fillOpacity="0.6" stroke="#14191f" strokeWidth="1.7" strokeLinejoin="round" />
              <line x1="21" y1="10" x2="48" y2="10" stroke="#14191f" strokeWidth="2.4" strokeLinecap="round" />

              {/* Tiny Driver Wearing Safety Helmet Inside Cab */}
              <circle cx="34" cy="17.2" r="3.4" fill="#8d5524" stroke="#14191f" strokeWidth="0.9" />
              <path d="M 30 16.5 C 30 12.6, 38 12.6, 38 16.5 Z" fill="#facc15" stroke="#14191f" strokeWidth="1" />
              <line x1="29.2" y1="16.5" x2="39.5" y2="16.5" stroke="#14191f" strokeWidth="1.3" strokeLinecap="round" />
              <rect x="30.8" y="20.2" width="6.5" height="5" rx="1.5" fill="#19473a" />
              {/* Steering Wheel */}
              <line x1="41" y1="24" x2="43.5" y2="19.5" stroke="#14191f" strokeWidth="1.4" strokeLinecap="round" />

              {/* Main Tractor Hood & Engine Body */}
              <path d="M 16 24 L 68 24 L 72 31 L 72 34 L 16 34 Z" fill="#eab308" stroke="#14191f" strokeWidth="1.6" strokeLinejoin="round" />
              {/* Terracotta Brand Stripe & Grille */}
              <rect x="48" y="27" width="18" height="2.8" rx="1" fill="#b84a27" />
              <line x1="66" y1="25.5" x2="66" y2="33" stroke="#14191f" strokeWidth="1.1" />
              <circle cx="71.2" cy="28" r="1.4" fill="#ffffff" stroke="#14191f" strokeWidth="0.8" />

              {/* Front Loader Arm & Scoop Bucket */}
              <path d="M 54 27 L 78 22 L 88 33" fill="none" stroke="#14191f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 54 27 L 78 22 L 88 33" fill="none" stroke="#eab308" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              {/* Scoop Bucket with Small Gravel Mound */}
              <path d="M 88 26 Q 94 21 99 27 Z" fill="#a89f91" stroke="#14191f" strokeWidth="0.9" />
              <path d="M 86 26 L 99 28 L 103 36 L 87 36 Z" fill="#334155" stroke="#14191f" strokeWidth="1.5" strokeLinejoin="round" />
            </g>

            {/* Big Rear Spinning Tractor Wheel */}
            <g className="sjk-wheel-spin">
              <circle cx="28" cy="35" r="9.5" fill="#1e293b" stroke="#14191f" strokeWidth="1.6" />
              <circle cx="28" cy="35" r="5" fill="#facc15" stroke="#14191f" strokeWidth="1.2" />
              <line x1="28" y1="30" x2="28" y2="40" stroke="#14191f" strokeWidth="1.1" />
              <line x1="23" y1="35" x2="33" y2="35" stroke="#14191f" strokeWidth="1.1" />
              <circle cx="28" cy="35" r="1.7" fill="#14191f" />
            </g>

            {/* Smaller Front Spinning Wheel */}
            <g className="sjk-wheel-spin-fast">
              <circle cx="65" cy="37.5" r="6.8" fill="#1e293b" stroke="#14191f" strokeWidth="1.5" />
              <circle cx="65" cy="37.5" r="3.4" fill="#facc15" stroke="#14191f" strokeWidth="1.1" />
              <line x1="65" y1="34" x2="65" y2="41" stroke="#14191f" strokeWidth="1" />
              <line x1="61.5" y1="37.5" x2="68.5" y2="37.5" stroke="#14191f" strokeWidth="1" />
              <circle cx="65" cy="37.5" r="1.2" fill="#14191f" />
            </g>
          </svg>
        </div>
      </div>

      {/* Hero Band */}
      <section id="top" className="sjk-hero-band">
        <div className="sjk-container sjk-hero-grid">
          <div>
            <div className="sjk-kicker sjk-mono sjk-hero-anim sjk-hero-d1">
              <span className="sjk-kicker-rule" />
              <span>Sijitek Solutions · Field Engineering</span>
            </div>

            <h1 className="sjk-hero-title sjk-hero-anim sjk-hero-d2">
              Bringing <em>practical solutions</em> to engineering &amp; construction.
            </h1>

            <p className="sjk-hero-lead sjk-hero-anim sjk-hero-d3">
              Too many construction decisions still rely on rough guesswork, scattered sketches, and unclear
              estimates. Sijitek Solutions builds straightforward, accurate tools designed for everyone involved in
              bringing a structure to life — from homeowners and surveyors to site contractors and engineers.
            </p>

            <div className="sjk-hero-actions sjk-hero-anim sjk-hero-d4">
              <a href="#products" className="sjk-btn-solid">
                <span>Explore Products</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              {primaryProduct && (
                <a href={primaryProduct.launchUrl} className="sjk-btn-outline">
                  <Ruler className="w-4 h-4" />
                  <span>Open {primaryProduct.name}</span>
                </a>
              )}
            </div>

            <div className="sjk-hero-meta sjk-hero-anim sjk-hero-d5">
              <div className="sjk-hero-meta-item">
                <span className="sjk-hero-meta-label sjk-mono">Built For</span>
                <span className="sjk-hero-meta-val">Homeowners · Surveyors · Contractors</span>
              </div>
              <div className="sjk-hero-meta-item">
                <span className="sjk-hero-meta-label sjk-mono">Availability</span>
                <span className="sjk-hero-meta-val">Laptop Web · Android · iOS</span>
              </div>
            </div>
          </div>

          <ArchitecturalRoofPlate />
        </div>
      </section>

      {/* Who It Serves */}
      <section id="who-it-serves" className="sjk-section">
        <div className="sjk-container">
          <div className="sjk-section-head sjk-reveal">
            <div>
              <div className="sjk-kicker sjk-mono" style={{ marginBottom: '8px' }}>
                <span className="sjk-kicker-rule" />
                <span>Built for Everyone on the Project</span>
              </div>
              <h2 className="sjk-section-title">One clear standard, from homeowner to site engineer.</h2>
              <p className="sjk-section-sub">
                Good construction tools shouldn&apos;t sit behind expensive desktop licenses. Our solutions bring
                clarity to every person responsible for measuring, budgeting, or building.
              </p>
            </div>
          </div>

          <div className="sjk-audience-grid">
            {AUDIENCE_GROUPS.map((group, idx) => (
              <div
                key={group.index}
                className="sjk-audience-card sjk-reveal"
                style={{ '--sjk-stagger': `${idx * 90}ms` }}
              >
                <span className="sjk-audience-index sjk-mono">NO. {group.index}</span>
                <span className="sjk-audience-role">{group.role}</span>
                <h3 className="sjk-audience-title">{group.title}</h3>
                <p className="sjk-audience-body">{group.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="sjk-section">
        <div className="sjk-container">
          <div className="sjk-section-head sjk-reveal">
            <div>
              <div className="sjk-kicker sjk-mono" style={{ marginBottom: '8px' }}>
                <span className="sjk-kicker-rule" />
                <span>Products</span>
              </div>
              <h2 className="sjk-section-title">Practical tools ready for the office and the site.</h2>
              <p className="sjk-section-sub">
                Every Sijitek Solutions product lives here — select your device below to launch immediately or install
                directly onto your phone.
              </p>
            </div>
            <span
              className="sjk-mono"
              style={{
                fontSize: '11.5px',
                color: '#434d56',
                padding: '6px 12px',
                border: '1px solid #c2bbb0',
                borderRadius: '6px',
                background: '#ffffff',
              }}
            >
              CATALOG // {products.length} LIVE
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {products.map((product) => (
              <article key={product.id} className="sjk-product-sheet sjk-reveal">
                <div className="sjk-product-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span className="sjk-mono" style={{ fontSize: '11.5px', fontWeight: 600, color: '#6c757d' }}>
                      {product.code}
                    </span>
                    <span style={{ color: '#c2bbb0' }}>|</span>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#14191f' }}>
                      {product.category}
                    </span>
                  </div>
                  <span className="sjk-status-tag">
                    <span className="sjk-status-dot" />
                    <span>{product.statusLabel}</span>
                  </span>
                </div>

                <div className="sjk-product-layout">
                  {/* Left: Product Specification */}
                  <div className="sjk-product-info">
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#14191f' }}>
                        {product.name}
                      </h3>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#b84a27', marginTop: '4px' }}>
                        {product.audience}
                      </div>
                      <p style={{ margin: '12px 0 0', fontSize: '14.5px', color: '#434d56', lineHeight: 1.65 }}>
                        {product.description}
                      </p>
                    </div>

                    <div className="sjk-spec-list">
                      {product.specs.map((sp, i) => (
                        <div key={i} className="sjk-spec-item">
                          <div className="sjk-spec-label">
                            <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#19473a' }} />
                            <span>{sp.label}</span>
                          </div>
                          <p className="sjk-spec-detail">{sp.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Install / Launch by Device */}
                  <div className="sjk-product-install">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                        <div>
                          <div className="sjk-mono" style={{ fontSize: '10.5px', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Get Started
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#14191f' }}>
                            Choose Your Device
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(product)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: '#ffffff',
                            border: '1px solid #c2bbb0',
                            color: copiedId === product.id ? '#19473a' : '#434d56',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedId === product.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === product.id ? 'Copied' : 'Copy Link'}</span>
                        </button>
                      </div>

                      <div className="sjk-device-list">
                        {product.devices.map((device) => (
                          <div key={device.id} className="sjk-device-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '8px',
                                  background: '#f6f4ef',
                                  border: '1px solid #d9d4c7',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {renderDeviceIcon(device.id)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#14191f' }}>
                                  {device.label}
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#6c757d', lineHeight: 1.35 }}>
                                  {device.sublabel}
                                </div>
                              </div>
                            </div>

                            {device.mode === 'direct' ? (
                              <a href={device.url} className="sjk-device-btn solid">
                                <span>{device.actionLabel}</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setGuideModal({ product, device })}
                                className="sjk-device-btn subtle"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>{device.actionLabel}</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className="sjk-mono"
                      style={{
                        fontSize: '11px',
                        color: '#6c757d',
                        paddingTop: '12px',
                        borderTop: '1px solid #d9d4c7',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Direct App URL:</span>
                      <a
                        href={product.launchUrl}
                        style={{ color: '#19473a', fontWeight: 600, textDecoration: 'none' }}
                      >
                        roofcalc.sijiteksolutions.com
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Upcoming Solutions Pipeline */}
          <div className="sjk-roadmap-box sjk-reveal" style={{ '--sjk-stagger': '100ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: '#f6f4ef',
                  border: '1px solid #d9d4c7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 36 36" width="32" height="32">
                  <g className="sjk-worker-head">
                    <circle cx="18" cy="21" r="7.5" fill="#8d5524" stroke="#14191f" strokeWidth="1.2" />
                    <circle cx="15.3" cy="20.5" r="1.1" fill="#14191f" />
                    <circle cx="20.7" cy="20.5" r="1.1" fill="#14191f" />
                    <path d="M 15.2 24 Q 18 26.2 20.8 24" fill="none" stroke="#14191f" strokeWidth="1.1" strokeLinecap="round" />
                    <path d="M 9.2 18.5 C 9.2 9.8, 26.8 9.8, 26.8 18.5 Z" fill="#facc15" stroke="#14191f" strokeWidth="1.3" />
                    <rect x="16" y="10.8" width="4" height="7.5" fill="#eab308" stroke="#14191f" strokeWidth="0.8" />
                    <line x1="7" y1="18.5" x2="29" y2="18.5" stroke="#14191f" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="7.5" y1="18.1" x2="28.5" y2="18.1" stroke="#facc15" strokeWidth="1.1" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#14191f' }}>
                  More Engineering &amp; Construction Solutions in the Studio
                </div>
                <div style={{ fontSize: '13px', color: '#434d56', marginTop: '2px' }}>
                  RoofCalc Pro is the first release in our field engineering suite. Future estimating, structural, and
                  construction planning tools will be published directly here under Products.
                </div>
              </div>
            </div>
            <span
              className="sjk-mono"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#b84a27',
                background: '#f7eae5',
                border: '1px solid rgba(184, 74, 39, 0.25)',
                padding: '5px 10px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              NEXT RELEASES IN PROGRESS
            </span>
          </div>
        </div>
      </section>

      {/* Studio Approach Band */}
      <section id="approach" className="sjk-manifesto-band">
        <div className="sjk-container">
          <div className="sjk-reveal" style={{ maxWidth: '660px' }}>
            <div className="sjk-mono" style={{ fontSize: '11.5px', color: '#e08d72', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Our Philosophy
            </div>
            <h2
              style={{
                margin: '10px 0 0',
                fontSize: 'clamp(1.65rem, 3vw, 2.35rem)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: '#ffffff',
                lineHeight: 1.15,
              }}
            >
              Engineering software should solve real site problems — quietly and reliably.
            </h2>
          </div>

          <div className="sjk-pillars-grid">
            {ENGINEERING_PILLARS.map((pillar, idx) => (
              <div
                key={pillar.code}
                className="sjk-pillar sjk-reveal"
                style={{ '--sjk-stagger': `${idx * 110}ms` }}
              >
                <span className="sjk-pillar-code sjk-mono">PRINCIPLE {pillar.code}</span>
                <h3 className="sjk-pillar-title">{pillar.title}</h3>
                <p className="sjk-pillar-body">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="sjk-footer">
        <div className="sjk-container sjk-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '5px',
                background: '#151c22',
                color: '#f6f4ef',
                borderBottom: '2px solid #b84a27',
                fontWeight: 800,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              S
            </span>
            <span>
              <strong style={{ color: '#14191f' }}>Sijitek Solutions</strong> — Practical solutions for engineering &amp; construction.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <a
              href="mailto:support@sijiteksolutions.com"
              className="sjk-mono"
              style={{ color: '#b84a27', textDecoration: 'none', fontWeight: 600 }}
            >
              support@sijiteksolutions.com
            </a>
            <a href="#who-it-serves" style={{ color: '#434d56', textDecoration: 'none', fontWeight: 600 }}>
              Who We Serve
            </a>
            <a href="#products" style={{ color: '#434d56', textDecoration: 'none', fontWeight: 600 }}>
              Products
            </a>
            {primaryProduct && (
              <a
                href={primaryProduct.launchUrl}
                style={{ color: '#19473a', textDecoration: 'none', fontWeight: 700 }}
              >
                {primaryProduct.name} ↗
              </a>
            )}
            <span className="sjk-mono">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Device Install Guide Modal (Clean Drafting Paper Style) */}
      {guideModal && (
        <div className="sjk-modal-backdrop" onClick={() => setGuideModal(null)}>
          <div className="sjk-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sjk-modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                {renderDeviceIcon(guideModal.device.id)}
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#14191f' }}>
                  {guideModal.device.actionLabel} — {guideModal.product.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideModal(null)}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: '1px solid #c2bbb0',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#434d56',
                  cursor: 'pointer',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="sjk-modal-body">
              {guideModal.device.steps?.map((step, i) => (
                <div key={i} className="sjk-step-row">
                  <span className="sjk-step-num sjk-mono">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginTop: '8px' }}>
                <a
                  href={guideModal.device.url}
                  className="sjk-device-btn solid"
                  style={{ justifyContent: 'center', padding: '10px 14px' }}
                >
                  {guideModal.device.id === 'ios' ? (
                    <Share className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                  <span>Open {guideModal.product.name}</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyLink(guideModal.product)}
                  className="sjk-device-btn subtle"
                  style={{ padding: '10px 12px' }}
                >
                  {copiedId === guideModal.product.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === guideModal.product.id ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
