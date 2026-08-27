/**
 * Where the Spring Boot backend lives.
 *
 * - Empty string  -> same origin (used when Spring Boot serves this page itself,
 *                    e.g. running locally at http://localhost:8080)
 * - Full URL      -> a separate backend host (used when the frontend is on Vercel)
 *
 * On Vercel, set this to your deployed backend, e.g.:
 *   window.BACKEND_URL = "https://vartalap-backend.onrender.com";
 */
window.BACKEND_URL = "";

