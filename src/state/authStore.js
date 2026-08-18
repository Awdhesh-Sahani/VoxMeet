/**
 * JWT storage decision: in-memory, NOT localStorage/sessionStorage.
 *
 * httpOnly cookie vs. in-memory — the trade-off:
 *   - httpOnly cookie: token never touches JS at all, so an XSS bug
 *     can't read it. Most secure option. But it needs the BACKEND to
 *     set the cookie (Set-Cookie on login response) and requires CSRF
 *     protection + `withCredentials`/CORS config on every request.
 *   - localStorage: simplest to wire up, survives refresh — but any
 *     injected script (XSS) can read it directly. Bad default for a
 *     token that grants full account access.
 *   - In-memory (plain JS variable / React state): not persisted, so
 *     a page refresh logs the user out — annoying, but it's not
 *     sitting in a place an XSS payload can casually read it either.
 *
 * Picked in-memory for this project: our Spring Boot backend returns
 * the JWT in the JSON response body (not a Set-Cookie header), so the
 * httpOnly-cookie route would mean backend changes we haven't made.
 * Between the two options that work with a JSON-body token
 * (localStorage vs. memory), memory is the safer default. Trade-off
 * we're accepting: refreshing the tab logs you out and guests
 * re-entering a link don't need auth anyway, so this is a fine trade
 * for an MVP demo.
 */

let currentToken = null;

export function setToken(token) {
  currentToken = token;
}

export function getToken() {
  return currentToken;
}

export function clearToken() {
  currentToken = null;
}
