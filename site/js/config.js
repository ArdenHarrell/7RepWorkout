/* Site configuration.

   API_BASE_URL
     The sign-up API lives on the same address as the site (https://7repworkout.com/api),
     so this normally stays "/api". Nothing to paste after deploying.

   TURNSTILE_SITE_KEY
     Your Cloudflare Turnstile SITE key (the public one). See DEPLOY.md, Step 2.
     Leave it "" and the CAPTCHA box is not shown (for testing only).
     The matching SECRET key goes in backend/samconfig.toml, never in this file. */
window.SEVENREP_CONFIG = {
  API_BASE_URL: "/api",
  TURNSTILE_SITE_KEY: "0x4AAAAAAFQc4zDMPpk9IL_Q"
};
