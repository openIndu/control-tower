const ACK_DEADLINE_HOURS = 72;

// ./dev ack <run-id>: the approved_by maintainer confirms a merge report by
// running this themself, in an interactive terminal, under the gh login
// that matches approved_by. Rejects otherwise -- this is a confirmation of
// a human decision already made at grant time, not a new approval the
// runner could extract through automation.
export function evaluateAck({ currentGhLogin, approvedBy, isInteractiveTerminal, now = new Date() }) {
  if (!isInteractiveTerminal) {
    return { accepted: false, reason: "./dev ack must run in an interactive terminal" };
  }
  if (currentGhLogin !== approvedBy) {
    return {
      accepted: false,
      reason: `gh is logged in as ${currentGhLogin}, not the approver ${approvedBy}`,
    };
  }
  return { accepted: true, ackAt: now.toISOString() };
}

// No ack within 72h of a merge: the next run auto-downgrades to PR-only
// until the ack catches up. mergedAt with no ackAt at all also counts (the
// maintainer never ran ./dev ack), not just a late one.
export function needsAckDowngrade({ mergedAt, ackAt, now = new Date() }) {
  if (!mergedAt) return false;
  if (ackAt) return false;
  const hoursSinceMerge = (now.getTime() - new Date(mergedAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceMerge > ACK_DEADLINE_HOURS;
}
