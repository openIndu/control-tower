// Log redaction: scrubs credential-shaped substrings from text before it
// is written to a log or report. This is defense in depth on TOP OF the
// environment-level controls in spec/005 section 2.6 (the minimal env
// allowlist, no credential-shaped vars besides the dedicated API key) --
// it is not the primary control, and it cannot be, because any regex list
// of "what a secret looks like" is inherently incomplete. Treat the
// patterns below as a known-good baseline to extend when a new shape is
// found, not a closed set.
const REDACTED = "[REDACTED]";

// Token formats with a recognizable, sufficiently specific prefix.
const PREFIXED_TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-ant-[A-Za-z0-9-]{20,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
];

// "Authorization: Bearer <token>" / "Authorization: token <token>" header
// lines -- keeps the scheme word, redacts only the credential.
const AUTH_HEADER_PATTERN = /\b(Authorization:\s*(?:Bearer|token))\s+\S+/gi;

// NAME=value / NAME: value assignments where NAME looks credential-shaped
// -- keeps the name, redacts only the value. Deliberately excludes a bare
// "KEY" (too generic, e.g. "PRIMARY_KEY" in an unrelated DB context) in
// favor of the more specific credential-shaped suffixes spec/005 section
// 2.6 itself lists for the env allowlist (*TOKEN*/*SECRET*/*PASSWORD*),
// plus API_KEY specifically.
const CREDENTIAL_ASSIGNMENT_PATTERN =
  /\b([A-Z0-9_]*(?:API_?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*([=:])\s*\S+/g;

export function redactSecrets(text) {
  let redacted = text;
  for (const pattern of PREFIXED_TOKEN_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED);
  }
  redacted = redacted.replace(AUTH_HEADER_PATTERN, `$1 ${REDACTED}`);
  redacted = redacted.replace(CREDENTIAL_ASSIGNMENT_PATTERN, `$1$2 ${REDACTED}`);
  return redacted;
}
