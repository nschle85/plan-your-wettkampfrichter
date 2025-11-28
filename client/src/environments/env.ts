export const environment = {
  // In production (served by the Node server or behind a proxy), use same-origin.
  // In Angular dev mode (http://localhost:4200), talk to the API on http://localhost:3000.
  apiUrl: (() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const { hostname, port, origin } = window.location;
      const isDevPort = port === '4200';
      const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '0.0.0.0';
      if (isDevPort && isLocalHost) {
        return 'http://localhost:3000';
      }
      return origin;
    }
    return 'http://localhost:3000';
  })()
};
