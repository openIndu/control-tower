# Python Coding Standards

> **Authoritative sources**: [PEP 8](https://peps.python.org/pep-0008/) (style), [PEP 484](https://peps.python.org/pep-0484/) (type hints), [PEP 257](https://peps.python.org/pep-0257/) (docstrings), [ruff](https://docs.astral.sh/ruff/) (linter — the repo's `ruff.toml` is the objective enforcer).
>
> **Principle**: The linter (`ruff`) IS the coding standard. If ruff passes, you're compliant. If you disagree with a ruff rule, file an issue — don't `# noqa` silently.

## 1. Imports

| Rule                                                                                                                            | Source                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| All imports at the **top of the file**, never inside function bodies (except documented lazy-import for circular-dep avoidance) | PEP 8 §Imports           |
| Order: stdlib → third-party → local (`app.`); blank line between groups                                                         | PEP 8 §Imports           |
| Use absolute imports (`from app.models import X`), not relative (`from ..models import X`) unless a package-internal case       | PEP 8 §Imports           |
| `__all__` for public API exports                                                                                                | PEP 8 §Public interfaces |
| Wildcard imports (`from x import *`) forbidden                                                                                  | PEP 8 §Imports           |

## 2. Naming

| Rule                                                                      | Source        |
| ------------------------------------------------------------------------- | ------------- |
| `snake_case` for functions, methods, variables                            | PEP 8 §Naming |
| `PascalCase` for classes                                                  | PEP 8 §Naming |
| `UPPER_SNAKE_CASE` for constants                                          | PEP 8 §Naming |
| `_leading_underscore` for private; `__double` for name-mangled            | PEP 8 §Naming |
| No single-char names except loop counters (`i`, `j`) or `_` for throwaway | PEP 8 §Naming |

## 3. Types & annotations

| Rule                                                         | Source                                              |
| ------------------------------------------------------------ | --------------------------------------------------- |
| Type hints required on all public function signatures        | PEP 484                                             |
| Use `X                                                       | None`(not`Optional[X]`) for nullable (Python 3.11+) | PEP 604 |
| Use `list[str]` not `List[str]` (built-in generics, PEP 585) | PEP 585                                             |
| Pydantic for all request/response schemas                    | FastAPI convention                                  |

## 4. Error handling

| Rule                                                                 | Source            |
| -------------------------------------------------------------------- | ----------------- |
| No bare `except:` — catch specific exceptions (`except ValueError:`) | PEP 8 §Exceptions |
| `except Exception` only at the top-level handler, with logging       | PEP 8 §Exceptions |
| Raise with context: `raise CustomError("msg") from original_exc`     | PEP 3134          |
| No `except: pass` (swallowing) without a comment explaining why      | PEP 8 §Exceptions |

## 5. Functions & data

| Rule                                                                      | Source              |
| ------------------------------------------------------------------------- | ------------------- |
| No mutable default arguments (`def f(x=[])` → use `None` + create inside) | Python gotcha       |
| f-strings, not `.format()` or `%`                                         | PEP 498 / PEP 8     |
| `pathlib.Path`, not `os.path`                                             | Modern Python       |
| `with` statement for resource management (files, sessions, locks)         | PEP 343             |
| No `print()` in production code — use `logging`                           | Production standard |

## 6. SQLAlchemy 2.0

| Rule                                                                                         | Source                   |
| -------------------------------------------------------------------------------------------- | ------------------------ |
| `session.execute(select(Model))` not `session.query(Model)`                                  | SQLAlchemy 2.0 migration |
| `session.execute(select(Model).where(Model.id == x))` not `session.query(Model).filter(...)` | SQLAlchemy 2.0           |
| Use `session.begin()` or `session.commit()` explicitly; don't rely on autoflush              | SQLAlchemy 2.0           |

## 7. Testing

| Rule                                                                          | Source            |
| ----------------------------------------------------------------------------- | ----------------- |
| `pytest` (not `unittest`)                                                     | Repo convention   |
| `assert` (not `self.assertEqual`)                                             | pytest convention |
| Test files: `tests/unit/test_<module>.py`, `tests/integration/test_<flow>.py` | Repo convention   |
| Fixtures: `@pytest.fixture`, scope-minimal                                    | pytest convention |
| No `print()` in tests — use `--capture=no` flag if you need to see output     | pytest convention |

## 8. Formatting (enforced by ruff/ruff-format)

| Rule                                                 | Source |
| ---------------------------------------------------- | ------ |
| Line length: see `ruff.toml` (default 88)            | ruff   |
| Indent: 4 spaces (no tabs)                           | PEP 8  |
| No trailing whitespace                               | PEP 8  |
| `ruff format` for auto-formatting (replaces `black`) | ruff   |
