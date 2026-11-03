---
name: build
description: "Build and push a Docker image for an openIndu service. Part of RULE 11 step ④ — image build → push to Aliyun CR. Use after aggregate submodule PR merges, when a service's image needs rebuilding, or to verify a Dockerfile builds correctly before PR."
argument-hint: "<service-name> [--tag <tag>] [--dry-run]"
disable-model-invocation: true
---

# /build — Image build and push (RULE 11 step ④)

Build a Docker image for an openIndu service and push it to the Aliyun Container Registry. This is step ④ of the RULE 11 delivery pipeline.

**Call `/principle` first** (RULE 1). This skill is typically used in the **aggregate repo** (`openindu-website`) which holds the docker-compose stack and submodule pointers. For repos outside the website aggregate (studio/platform/controller), adapt the build context per that repo's `Dockerfile` location.

---

## 1. Determine what to build

Use `/route <service-name>` to get the service's `image` registry path. If no image field exists, this service doesn't produce a container image — stop.

| Repo                        | Image registry path                              | Dockerfile location              |
| --------------------------- | ------------------------------------------------ | -------------------------------- |
| `openindu-backend`          | `${OPENINDU_REGISTRY}/openindu/openindu-backend` | `openIndu-backend/Dockerfile`    |
| `openindu-admin`            | `${OPENINDU_REGISTRY}/openindu/openindu-admin`   | `openIndu-admin/Dockerfile.k8s`  |
| `openindu-portal`           | `${OPENINDU_REGISTRY}/openindu/openindu-portal`  | `openIndu-portal/Dockerfile.k8s` |
| Other (studio/platform/etc) | per their own registry                           | per their own repo               |

> `${OPENINDU_REGISTRY}` is this deployment's Aliyun Container Registry host. It is deliberately not committed — export it in your shell or take it from your `docker login` target. The `${OPENINDU_PROD_DB_*}` placeholders in `route.json` work the same way (RULE 5.4: infrastructure endpoints are injected, never committed).

> **Frontend repos ship two Dockerfiles — pick `Dockerfile.k8s` for anything that reaches a cluster.** `Dockerfile` bakes `nginx.conf`, which proxies `/api/` to a docker-compose service name and exists for the local stack; `Dockerfile.k8s` bakes `nginx.k8s.conf`, which serves static files only because the Ingress routes `/api/` to the API Service. Building the compose variant for production does not hard-fail — the Service name usually resolves in-cluster — it silently adds a proxy hop that bypasses the Ingress routing the manifests declare. Verify with `grep -n COPY <repo>/Dockerfile*` before building.

> The table above shows the website-aggregate services. For repos with `release_flow: "independent"` in `route.json`, consult that repo's own build documentation.

## 2. Determine the tag

```
/build openindu-backend                    # auto-generate: git short SHA of the built commit
/build openindu-backend --tag v1.2.3       # explicit semver
/build openindu-backend --tag hotfix-xxx   # hotfix
/build openindu-backend --dry-run          # validate Dockerfile only, don't push
```

Default tag: the **full SHA of the actual checked-out source commit**, validated against the passing test record. Never label a working-directory build using a different `origin/main` commit. This is what the manifests in the gitops repo pin, so the tag is traceable straight back to a commit — `grep image: <gitops>/**.yaml` should always land on a resolvable SHA.

Deployments must pin an immutable tag; **never point a Deployment at `:latest`** (inspector flags it as image-tag drift). That is a constraint on the manifest, not on what you push: if a manifest still pins a moving tag, keep publishing that tag alongside the SHA until the manifest is fixed, otherwise the build silently stops reaching that workload. Check before you drop a tag:

```bash
grep -rn "image:.*<service>" <gitops-repo>/
```

> Known case: `infra-deploy/openIndu-website/rag-server.yaml` pins `openindu-backend:latest`. Until it is re-pinned to a SHA, backend builds must push both `:latest` and the SHA.

## 3. Build

Create a versioned build manifest outside the source checkout with `sourceSha`,
`repo`, `checkpoint: {stateFile, taskId}`, Dockerfile, context and platform.
The helper reads the durable task checkpoint, verifies all stage hashes and
the passing test SHA; a self-declared test result in the build manifest is insufficient.
For aggregated services also supply `aggregate: {directory, sourceSha, submodulePath}`.
Fetch and verify the aggregate source SHA is merged on its remote default branch;
read its gitlink, rather than using a local submodule status as merge evidence.
Verify the test artifact and its hash against the task checkpoint first, then run:

```text
node <plugin-root>/skills/build/scripts/check-source.mjs <source-dir> <manifest.json>
```

Any mismatch, dirty file or uninitialized/changed submodule blocks the build.
Build from an isolated checkout of that SHA; rerun the source check after build
before push. Record source SHA, test evidence, Dockerfile/context/platform and
local image ID in the manifest. The request's task ID follows
`reference/workflow-execution.md`.

```bash
# From the aggregate repo root (openindu-website). Note the build context is the
# SUBMODULE directory, not the aggregate root:
docker build \
  --tag ${OPENINDU_REGISTRY}/openindu/<service>:<tag> \
  --file <service>/<Dockerfile-or-Dockerfile.k8s> \
  ./<service>
```

The trailing `./<service>` matters. Each submodule carries its own `.dockerignore`; passing the aggregate root as context ignores those, sends every sibling submodule plus any local model/data directories to the daemon, and can turn a 10 MB layer push into a multi-GB one.

For services outside the website aggregate, build from that repo's root with its own Dockerfile path.

Pre-build checks:

- Submodule pointer is at the merged commit (RULE 11 step ③ must be done first)
- `.dockerignore` excludes `.git`, `node_modules`, `__pycache__`, `.env*`
- Working tree is clean

## 4. Push

```bash
docker push ${OPENINDU_REGISTRY}/openindu/<service>:<tag>
```

Registry credentials must be pre-configured (`docker login`). The agent does NOT hold registry credentials — if `docker push` fails with "unauthorized", stop and tell the user to `docker login` first.

## 5. Verify

Read the authoritative registry, not the local Docker cache:

```bash
docker buildx imagetools inspect <registry>/<image>:<validated-source-sha>
docker buildx imagetools inspect <registry>/<image>@sha256:<remote-digest>
```

Both reads must succeed. Record the remote manifest digest, platform descriptors,
source SHA and command output in the build manifest. Local `docker inspect` is
not push verification. Missing credentials or registry errors leave the build
unverified. Checkpoint `action: "build"` with `sourceSha`, immutable `image`
reference and the registry evidence artifact; the checkpoint also verifies all
stage evidence hashes. `/publish` must consume this exact manifest/digest and
reject changed source or obsolete tests. Never infer deployed state from a push.

## 6. Report for RULE 11

After a successful build, report the image tag for `/delivery-check`:

```
④ image: ${OPENINDU_REGISTRY}/openindu/<service>:<tag>   ✅ built + pushed
```

The next step is ⑤ — create the infra-deploy PR to update the image tag in the K8s manifest.

## Boundary

`/build` only does step ④ of RULE 11. It does not:

- Run `kubectl apply` (step ⑥ is human-only)
- Create the infra-deploy PR (step ⑤ — use the `release` agent or do it manually)
- Decide when to build (that's the `release` agent's coordination)

> **In `openindu-website`, prefer that repo's own `/release` command.** It covers ④+⑤ in one pass (build/push, then the infra-deploy Gitee PR) and carries the aggregate's local details — `Dockerfile.k8s` selection, the dual `:latest` + SHA tag, the submodule build context, and the Gitee `pull/new/...` PR URL. This skill remains the generic step-④ path for repos with no aggregate-specific command.

## Troubleshooting

| Problem                                 | Fix                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `docker push` unauthorized              | User runs `docker login` to Aliyun CR                                                                             |
| Dockerfile not found                    | Check `route.json` for the repo type; some repos have no Dockerfile                                               |
| Submodule not at merged commit          | Run step ③ first: update submodule pointer + PR merge                                                             |
| Build context too large                 | Context must be the submodule dir, not the aggregate root; check that submodule's `.dockerignore` excludes `.git` |
| Image already exists with this tag      | The SHA tag is already published for that commit — rebuild only if the Dockerfile changed, else reuse it          |
| Frontend 502 / API calls bypass Ingress | Built with `Dockerfile` instead of `Dockerfile.k8s` — the compose nginx config got baked in                       |

## Change log

- 2026-11-03: Bound build tags to tested checkout SHA and required registry digest read-back.
