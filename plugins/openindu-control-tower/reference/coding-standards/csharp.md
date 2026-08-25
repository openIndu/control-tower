# C# / .NET Coding Standards

> **Authoritative sources**: [.NET Framework Design Guidelines](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/) (API design), [C# coding conventions](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-guidelines/) (style), [Roslyn analyzers](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/overview) (linter — the objective enforcer), [EditorConfig](https://editorconfig.org/) (`.editorconfig` / `Directory.Build.props`).
>
> **Principle**: Roslyn analyzers + `dotnet format` ARE the coding standard. If analyzers pass + `dotnet format verify` is clean, you're compliant. Don't `#pragma warning disable` silently — discuss in an issue.

## 1. Imports & using

| Rule                                                                           | Source           |
| ------------------------------------------------------------------------------ | ---------------- |
| `using` directives at the **top of the file**, never inside methods            | C# convention    |
| Global usings (`global using System;`) for commonly-used namespaces (C# 10+)   | C# 10 feature    |
| Remove unused `using` (enforced by IDE0065 / `dotnet format`)                  | Roslyn           |
| Namespace: file-scoped (`namespace Foo;`) preferred over block-scoped (C# 10+) | C# 10 convention |

## 2. Naming

| Rule                                                              | Source          |
| ----------------------------------------------------------------- | --------------- |
| `PascalCase` for public members, types, namespaces, methods       | .NET guidelines |
| `_camelCase` for private fields (underscore prefix)               | .NET convention |
| `camelCase` for local variables, parameters                       | .NET guidelines |
| `I` prefix for interfaces (`IDevice`, `IRepository`)              | .NET guidelines |
| Async methods suffixed with `Async` (`ReadAsync`, `ProcessAsync`) | .NET convention |

## 3. Async & concurrency

| Rule                                                                                            | Source                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------- |
| `async/await`, never `.Result` / `.Wait()` on async tasks                                       | Deadlock risk (sync-over-async) |
| `CancellationToken` parameter on all async methods that may be long-running                     | .NET guidelines                 |
| `ConfigureAwait(false)` in library code (no UI context)                                         | Convention                      |
| No `async void` except event handlers                                                           | Convention                      |
| `ValueTask<T>` over `Task<T>` for hot paths where the result is usually available synchronously | .NET performance                |

## 4. Types & nullability

| Rule                                                               | Source          |
| ------------------------------------------------------------------ | --------------- |
| Nullable reference types enabled (`<Nullable>enable</Nullable>`)   | C# 8+ / .NET 6+ |
| No `!` (null-forgiving) without a comment explaining why           | Convention      |
| `record` for immutable data carriers (C# 9+)                       | C# convention   |
| `init` setters for DTO properties (not `set`)                      | C# 9+           |
| Prefer `var` when type is obvious from RHS; explicit type when not | .NET guidelines |

## 5. Error handling

| Rule                                                                     | Source          |
| ------------------------------------------------------------------------ | --------------- |
| Throw specific exceptions (`InvalidOperationException`, not `Exception`) | .NET guidelines |
| `ArgumentNullException.ThrowIfNull(x)` for parameter validation (C# 10+) | .NET            |
| No empty `catch` blocks — log + rethrow or handle                        | .NET guidelines |
| `using` statement/declaration for `IDisposable`                          | C# convention   |
| No `goto`                                                                | Convention      |

## 6. LINQ & data

| Rule                                                                                                       | Source          |
| ---------------------------------------------------------------------------------------------------------- | --------------- |
| LINQ preferred over manual loops for transformations/filters                                               | .NET convention |
| `Enumerable.Any()` not `.Count() > 0`                                                                      | Performance     |
| No magic strings — use `const` or `enum`                                                                   | Maintainability |
| String comparison: `StringComparison.Ordinal` for exact, `InvariantCultureIgnoreCase` for case-insensitive | .NET guidelines |

## 7. Documentation & build

| Rule                                                                               | Source                  |
| ---------------------------------------------------------------------------------- | ----------------------- |
| `/// <summary>` XML doc on all public members                                      | .NET convention         |
| `Directory.Build.props` for org-wide properties (target framework, nullable, etc.) | MSBuild convention      |
| No `Console.WriteLine` in production — use `ILogger<T>`                            | .NET logging convention |
| `dotnet format verify` (formatting verified, no changes)                           | CI gate                 |
| Roslyn analyzers: `CAxxxx` rules treated as errors, not warnings                   | CI gate                 |
