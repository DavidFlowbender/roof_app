/**
 * Hostname & route detection separating:
 * - Company & Products Portal: sijiteksolutions.com / www.sijiteksolutions.com (or ?site=sijitek / /products)
 * - RoofCalc Pro App: roofcalc.sijiteksolutions.com (and default localhost)
 */
export function isCompanySiteHost() {
  if (typeof window === 'undefined') return false;
  try {
    const host = (window.location.hostname || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    const params = new URLSearchParams(window.location.search || '');

    if (params.get('site') === 'sijitek') return true;
    if (params.get('app') === 'roofcalc') return false;

    if (host === 'sijiteksolutions.com' || host === 'www.sijiteksolutions.com') {
      return true;
    }

    // Allow previewing the Products portal on localhost via /products
    if ((host === 'localhost' || host === '127.0.0.1') && (path === '/products' || path === '/products/')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function getRoofCalcLaunchUrl() {
  if (typeof window === 'undefined') return 'https://roofcalc.sijiteksolutions.com';
  const host = (window.location.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${window.location.origin}/?app=roofcalc`;
  }
  return 'https://roofcalc.sijiteksolutions.com';
}
