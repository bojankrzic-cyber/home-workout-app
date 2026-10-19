/*
 * Deployment settings. Empty Supabase values = the app runs local-only (no account UI).
 * The anon key is public by design (it ships to every browser); row-level security in
 * supabase/migrations protects the data. Never put the service-role key here.
 */
window.FS_CONFIG = Object.assign({
  supabaseUrl: '',          // https://<project-ref>.supabase.co  – EU (Frankfurt) project
  supabaseAnonKey: '',      // Project Settings → API → anon public
  privacyUrl: 'https://www.naturesfinest.si'   // TODO: exact privacy-policy page incl. the Formshaper section
}, window.FS_CONFIG || {});
