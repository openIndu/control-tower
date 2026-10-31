import { execFileSync } from "node:child_process";

// guardG9 (guards-g7-g11.mjs) checks that every CODEOWNERS-named owner for
// the changed paths is itself a real, authorized approver -- RULE 5.3's
// "the owner of every changed path (CODEOWNERS) is the approver". This is a
// CODEOWNERS self-consistency check (a stale or typo'd CODEOWNERS entry
// naming someone who cannot actually approve), not a per-PR "who approved
// this" check -- so "authorized approver" here means "a real collaborator
// with push+ permission on the repo", read fresh from GitHub, not a
// separately maintained roster (no such roster exists anywhere in
// route.json/dev.schema.json).
//
// Known simplification: only resolves individual @login entries, matching
// collaborators.*.login prefixed with "@" for direct comparison against
// codeowners.mjs's raw (still-"@"-prefixed) owner tokens. CODEOWNERS team
// entries (@org/team-name) are not resolved to their members -- a stated
// gap, not a silent one. Revisit if/when a real repo's CODEOWNERS file
// actually uses team syntax.
function defaultExecGh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function listAuthorizedApprovers({ org, repo }, execGh = defaultExecGh) {
  const raw = execGh([
    "api",
    `repos/${org}/${repo}/collaborators`,
    "--jq",
    "[.[] | select(.permissions.push == true) | .login]",
  ]);
  const logins = JSON.parse(raw);
  return logins.map((login) => `@${login}`);
}
