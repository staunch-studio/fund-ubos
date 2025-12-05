**The Logrum Foundation Coding Standards**

1. **Naming:** Classes are `PascalCase`, methods/variables are `camelCase`, constants are `UPPER_SNAKE_CASE`.
2. **Modern Java:** Use `record` for data carriers. Use `var` for local readability.
3. **No Blocking:** Since we use WebFlux, never call `.block()` or use blocking I/O in the reactive chain.
4. **No Nulls:** Return `Optional` or `Mono.empty()` instead of `null`.
5. **Logging:** Use SLF4J placeholders (`{}`). Never use `System.out`.
6. **Testing:** Integration tests must use Testcontainers.
7. **Immutability:** Prefer `final` fields and constructor injection.
