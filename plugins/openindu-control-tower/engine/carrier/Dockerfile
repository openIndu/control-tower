FROM node:22-slim

# spec/005 section 2.6: "固定 CLI 版本" -- pinned explicitly, never
# @latest. 2.1.312 is current as of this carrier's implementation
# (2026-10-29); bumping it is a deliberate, reviewed change, not an
# automatic float.
ARG CLAUDE_CODE_VERSION=2.1.312
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# git is needed for the agent's own local commits inside the worktree
# (never a push -- there is no network route to GitHub from this
# container at all, enforced by the internal network, not by git config).
RUN apt-get update && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

# No credential helper and no git identity baked in. Every gh/git
# operation that needs real credentials (fetching issue data, pushing
# branches, opening/merging PRs) happens OUTSIDE this container, in the
# runner's own trusted process. This container only ever runs the LLM
# agent's code-editing and local-check work inside the mounted worktree.
RUN git config --system credential.helper "" \
 && git config --system user.useConfigOnly true

RUN useradd --create-home --home-dir /home/agent --uid 10001 --shell /bin/bash agent \
 && mkdir -p /home/agent/.config/gh \
 && chown -R agent:agent /home/agent

ENV HOME=/home/agent \
    USERPROFILE=/home/agent \
    GH_CONFIG_DIR=/home/agent/.config/gh \
    GIT_TERMINAL_PROMPT=0

COPY --chmod=755 run-positive-controls.sh /usr/local/bin/run-positive-controls.sh

USER agent
WORKDIR /workspace

ENTRYPOINT ["claude"]
