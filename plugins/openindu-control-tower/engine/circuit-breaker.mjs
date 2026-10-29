// Circuit breaker (spec/005 section 2.3, point 5): any one of four
// conditions stops all further merges for the rest of this run and every
// future run, until a human clears .dev-pause. Each condition is a fact
// the orchestration layer has already determined by tracking run history
// (e.g. counting consecutive BLOCKED issues, counting repeated tool
// errors) -- this function only combines already-evaluated facts, the
// same "caller supplies what needs real state/history" pattern used by
// guardG1/guardG8/guardG11.
export function shouldTripCircuitBreaker({
  ciTurnedRedPostMerge,
  nonRunnerMergeDetected,
  twoConsecutiveBlockedIssues,
  repeatedToolErrors,
}) {
  const reasons = [];
  if (ciTurnedRedPostMerge) reasons.push("default branch CI turned red after a merge");
  if (nonRunnerMergeDetected) reasons.push("a non-runner merge was detected");
  if (twoConsecutiveBlockedIssues) reasons.push("2 consecutive issues ended BLOCKED");
  if (repeatedToolErrors) reasons.push("repeated tool errors");
  return reasons.length > 0 ? { tripped: true, reasons } : { tripped: false, reasons: [] };
}

const REVERT_PATTERN = /This reverts commit ([0-9a-f]{7,40})/i;

// Textual revert detection only: scans default-branch commit messages for
// git's own "This reverts commit <sha>" format (what `git revert` writes)
// referencing a SHA this runner recorded as its own merge. Spec/005 also
// names "an equivalent inverse patch" as a trigger -- detecting that
// generically needs fetching and diffing the actual patches, not just
// comparing commit-message strings, and is NOT done here. That gap is
// flagged, not silently assumed covered.
export function detectRevertOfRecordedMerge(commitMessages, recordedMergeShas) {
  const recorded = new Set(recordedMergeShas);
  const detected = [];
  for (const message of commitMessages) {
    const match = message.match(REVERT_PATTERN);
    if (!match) continue;
    const revertedShaPrefix = match[1].toLowerCase();
    const hit = [...recorded].find(
      (sha) =>
        sha.toLowerCase().startsWith(revertedShaPrefix) ||
        revertedShaPrefix.startsWith(sha.toLowerCase()),
    );
    if (hit) detected.push({ sha: hit, revertingCommitMessage: message });
  }
  return detected;
}
