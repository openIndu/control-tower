# Rust Coding Standards

> **Authoritative sources**: [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/) (crate design), [Clippy](https://doc.rust-lang.org/clippy/) (linter — the objective enforcer), [rustfmt](https://github.com/rust-lang/rustfmt) (formatting), [Rust Book](https://doc.rust-lang.org/book/) (idioms).
>
> **Principle**: `cargo clippy` IS the coding standard. If clippy passes (zero warnings), you're compliant. `cargo fmt` for formatting. Don't `#[allow(clippy::...)]` silently — discuss in an issue.

## 1. Imports & modules

| Rule                                                                   | Source                           |
| ---------------------------------------------------------------------- | -------------------------------- |
| `use` imports at the **top of the file**, never inside function bodies | Rust convention                  |
| Group: std → external crates → `crate::` internal; blank line between  | rustfmt convention               |
| Re-export public API via `pub use` (globs allowed for prelude)         | API Guidelines §Interoperability |
| No wildcard `use` except for prelude-like re-exports                   | Clippy convention                |

## 2. Error handling

| Rule                                                                                 | Source                         |
| ------------------------------------------------------------------------------------ | ------------------------------ |
| **No `unwrap`/`expect` on device-input or external-data paths** — use `?` or `match` | Clippy + edge safety           |
| Use `?` operator for error propagation, not manual `match`/`return Err`              | Rust idiom                     |
| `thiserror::Error` for library errors; `anyhow` for application errors               | Convention                     |
| `Result<T, E>` for fallible functions; never `Option` when an error carries context  | API Guidelines §Predictability |
| No silent error swallowing (`.ok()` discarding the error) without a comment          | Convention                     |

## 3. Types & safety

| Rule                                                                              | Source                         |
| --------------------------------------------------------------------------------- | ------------------------------ |
| No `unsafe` without a `// SAFETY:` comment explaining the invariant               | Rust convention                |
| Use `newtype` wrappers for domain types (`struct UserId(pub String)`)             | API Guidelines §Type safety    |
| `impl Trait` or `dyn Trait` for abstraction; prefer `impl Trait` for return types | API Guidelines                 |
| No `.clone()` in hot paths without a comment                                      | Clippy                         |
| `#[must_use]` on functions whose return value must not be ignored                 | API Guidelines §Predictability |

## 4. Concurrency

| Rule                                                                        | Source         |
| --------------------------------------------------------------------------- | -------------- |
| Prefer message passing (channels) over shared state with locks              | Rust Book §16  |
| `Send + Sync` bounds documented for public types crossing thread boundaries | API Guidelines |
| No `unwrap()` on `Arc::try_unwrap` or `Mutex::lock` — handle the error      | Clippy         |

## 5. Documentation

| Rule                                                                | Source                         |
| ------------------------------------------------------------------- | ------------------------------ |
| `///` doc comments on all public items (functions, structs, traits) | API Guidelines §Documentation  |
| Include `# Examples` section with a runnable doctest                | API Guidelines §Documentation  |
| `//!` module-level docs at the top of `lib.rs` / `main.rs`          | API Guidelines                 |
| Panic docs: `# Panics` section if the function can panic            | API Guidelines §Predictability |

## 6. Build & deps

| Rule                                                | Source              |
| --------------------------------------------------- | ------------------- |
| `Cargo.lock` committed                              | Reproducible builds |
| No duplicate deps — `cargo tree --duplicates`       | Convention          |
| `cargo clippy -- -D warnings` (warnings are errors) | CI gate             |
| `cargo fmt -- --check` (formatting verified)        | CI gate             |
| No `println!` in production — use `tracing` crate   | Edge convention     |
