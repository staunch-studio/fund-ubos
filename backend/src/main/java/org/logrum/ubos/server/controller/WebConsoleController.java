package org.logrum.ubos.server.controller.console;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.service.LcmKernelService;
import org.logrum.ubos.server.controller.console.dto.ConsoleRequest;
import org.logrum.ubos.server.controller.console.dto.ConsoleResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * Web Console Controller for the Developer Dashboard.
 * <p>
 * Provides a REST API that simulates a terminal interface,
 * accepting raw command strings and returning formatted output.
 * </p>
 *
 * @author UBOS Team
 * @since 1.0.0
 */
@Slf4j
@RestController
@RequestMapping("/api/console")
@RequiredArgsConstructor
public class WebConsoleController {

    // ANSI Color Codes for terminal output
    private static final String ANSI_RESET = "\u001B[0m";
    private static final String ANSI_GREEN = "\u001B[32m";
    private static final String ANSI_RED = "\u001B[31m";
    private static final String ANSI_YELLOW = "\u001B[33m";
    private static final String ANSI_CYAN = "\u001B[36m";
    private static final String ANSI_BOLD = "\u001B[1m";

    private static final String DEFAULT_BRANCH = "master";
    private static final String DEFAULT_AUTHOR = "web-console";

    private final LcmKernelService kernelService;
    private final ObjectMapper objectMapper;

    /**
     * Executes a raw command string and returns the output.
     *
     * @param request the console request containing the command
     * @return reactive response with command output
     */
    @PostMapping("/exec")
    public Mono<ConsoleResponse> executeCommand(@RequestBody ConsoleRequest request) {
        if (request == null || request.command() == null || request.command().isBlank()) {
            return Mono.just(ConsoleResponse.error(formatError("No command provided. Type 'help' for available commands.")));
        }

        var command = request.command().trim();
        log.debug("Executing console command: {}", command);

        try {
            var parsed = CommandParser.parse(command);
            return executeCommand(parsed);
        } catch (IllegalArgumentException e) {
            return Mono.just(ConsoleResponse.error(formatError("Invalid command: " + e.getMessage())));
        } catch (Exception e) {
            log.error("Command execution failed: {}", command, e);
            return Mono.just(ConsoleResponse.error(formatError("Unexpected error: " + e.getMessage())));
        }
    }

    /**
     * Routes parsed command to appropriate handler.
     *
     * @param cmd the parsed command
     * @return reactive response
     */
    private Mono<ConsoleResponse> executeCommand(CommandParser.ParsedCommand cmd) {
        return switch (cmd.name()) {
            case "commit" -> handleCommit(cmd);
            case "show", "cat" -> handleShow(cmd);
            case "checkout" -> handleCheckout(cmd);
            case "exists" -> handleExists(cmd);
            case "search" -> handleSearch(cmd);
            case "help", "?" -> Mono.just(ConsoleResponse.success(getHelpText()));
            case "clear" -> Mono.just(ConsoleResponse.success("\u001B[2J\u001B[H")); // Clear screen
            case "version" -> Mono.just(ConsoleResponse.success(formatInfo("UBOS Kernel v1.0.0 - Git for Data")));
            default -> Mono.just(ConsoleResponse.error(
                    formatError("Unknown command: '" + cmd.name() + "'. Type 'help' for available commands.")));
        };
    }

    // ==================== Command Handlers ====================

    /**
     * Handles the 'commit' command.
     * <p>
     * Syntax: commit --type TYPE --slug SLUG [--branch BRANCH] --data JSON --msg MESSAGE
     * Or: commit TYPE SLUG BRANCH JSON_DATA MESSAGE (positional)
     * </p>
     */
    private Mono<ConsoleResponse> handleCommit(CommandParser.ParsedCommand cmd) {
        String type;
        String slug;
        String branch;
        String data;
        String msg;

        // Support both --option and positional arguments
        if (cmd.options().containsKey("type")) {
            // Named options mode
            type = cmd.getOption("type").orElse(null);
            slug = cmd.getOption("slug").orElse(null);
            branch = cmd.getOption("branch", DEFAULT_BRANCH);
            data = cmd.getOption("data").orElse(null);
            msg = cmd.getOption("msg").orElse("Committed via web console");
        } else {
            // Positional mode: commit TYPE SLUG BRANCH DATA MSG
            type = cmd.getArg(0).orElse(null);
            slug = cmd.getArg(1).orElse(null);
            branch = cmd.getArg(2).orElse(DEFAULT_BRANCH);
            data = cmd.getArg(3).orElse(null);
            msg = cmd.getArg(4).orElse("Committed via web console");
        }

        // Validation
        if (type == null || type.isBlank()) {
            return Mono.just(ConsoleResponse.error(formatError(
                    "Missing required argument: type\n" +
                    "Usage: commit --type TYPE --slug SLUG --data JSON [--branch BRANCH] [--msg MESSAGE]")));
        }
        if (slug == null || slug.isBlank()) {
            return Mono.just(ConsoleResponse.error(formatError("Missing required argument: slug")));
        }
        if (data == null || data.isBlank()) {
            return Mono.just(ConsoleResponse.error(formatError("Missing required argument: data (JSON)")));
        }

        // Validate JSON
        try {
            objectMapper.readTree(data);
        } catch (JsonProcessingException e) {
            return Mono.just(ConsoleResponse.error(formatError("Invalid JSON data: " + e.getMessage())));
        }

        return kernelService.commit(type.toUpperCase(), slug, branch, data, DEFAULT_AUTHOR, msg)
                .map(commitId -> ConsoleResponse.success(
                        formatSuccess("Commit successful! ID: " + commitId) +
                        "\n" + formatInfo("  Type: " + type.toUpperCase()) +
                        "\n" + formatInfo("  Slug: " + slug) +
                        "\n" + formatInfo("  Branch: " + branch)))
                .onErrorResume(e -> {
                    log.error("Commit failed", e);
                    return Mono.just(ConsoleResponse.error(formatError("Commit failed: " + e.getMessage())));
                });
    }

    /**
     * Handles the 'show' / 'cat' command.
     * <p>
     * Syntax: show --type TYPE --slug SLUG [--branch BRANCH]
     * Or: show TYPE SLUG [BRANCH]
     * </p>
     */
    private Mono<ConsoleResponse> handleShow(CommandParser.ParsedCommand cmd) {
        String type;
        String slug;
        String branch;

        if (cmd.options().containsKey("type")) {
            type = cmd.getOption("type").orElse(null);
            slug = cmd.getOption("slug").orElse(null);
            branch = cmd.getOption("branch", DEFAULT_BRANCH);
        } else {
            type = cmd.getArg(0).orElse(null);
            slug = cmd.getArg(1).orElse(null);
            branch = cmd.getArg(2).orElse(DEFAULT_BRANCH);
        }

        if (type == null || slug == null) {
            return Mono.just(ConsoleResponse.error(formatError(
                    "Missing required arguments.\n" +
                    "Usage: show --type TYPE --slug SLUG [--branch BRANCH]")));
        }

        return kernelService.getResourceSnapshot(type.toUpperCase(), slug, branch)
                .map(snapshot -> ConsoleResponse.success(
                        formatHeader("Snapshot: " + type.toUpperCase() + "/" + slug + " @ " + branch) +
                        "\n" + prettyPrintJson(snapshot)))
                .switchIfEmpty(Mono.just(ConsoleResponse.error(
                        formatWarning("No snapshot found for " + type + "/" + slug + " @ " + branch))))
                .onErrorResume(e -> {
                    log.error("Show failed", e);
                    return Mono.just(ConsoleResponse.error(formatError("Failed to read snapshot: " + e.getMessage())));
                });
    }

    /**
     * Handles the 'checkout' command.
     * <p>
     * Syntax: checkout --cid COMMIT_ID
     * Or: checkout COMMIT_ID
     * </p>
     */
    private Mono<ConsoleResponse> handleCheckout(CommandParser.ParsedCommand cmd) {
        String cidStr = cmd.getOption("cid")
                .or(() -> cmd.getArg(0))
                .orElse(null);

        if (cidStr == null) {
            return Mono.just(ConsoleResponse.error(formatError(
                    "Missing required argument: commit ID\n" +
                    "Usage: checkout --cid COMMIT_ID")));
        }

        long commitId;
        try {
            commitId = Long.parseLong(cidStr);
        } catch (NumberFormatException e) {
            return Mono.just(ConsoleResponse.error(formatError("Invalid commit ID: " + cidStr)));
        }

        return kernelService.getSnapshotByCommit(commitId)
                .map(snapshot -> ConsoleResponse.success(
                        formatHeader("Checkout: Commit #" + commitId) +
                        "\n" + prettyPrintJson(snapshot)))
                .switchIfEmpty(Mono.just(ConsoleResponse.error(
                        formatWarning("No snapshot found for commit ID: " + commitId))))
                .onErrorResume(e -> {
                    log.error("Checkout failed", e);
                    return Mono.just(ConsoleResponse.error(formatError("Failed to checkout: " + e.getMessage())));
                });
    }

    /**
     * Handles the 'exists' command.
     * <p>
     * Syntax: exists --slug SLUG
     * Or: exists SLUG
     * </p>
     */
    private Mono<ConsoleResponse> handleExists(CommandParser.ParsedCommand cmd) {
        String slug = cmd.getOption("slug")
                .or(() -> cmd.getArg(0))
                .orElse(null);

        if (slug == null) {
            return Mono.just(ConsoleResponse.error(formatError(
                    "Missing required argument: slug\n" +
                    "Usage: exists --slug SLUG")));
        }

        return kernelService.exists(slug)
                .map(exists -> {
                    if (Boolean.TRUE.equals(exists)) {
                        return ConsoleResponse.success(formatSuccess("Resource '" + slug + "' exists"));
                    } else {
                        return ConsoleResponse.success(formatWarning("Resource '" + slug + "' does not exist"));
                    }
                })
                .onErrorResume(e -> {
                    log.error("Exists check failed", e);
                    return Mono.just(ConsoleResponse.error(formatError("Check failed: " + e.getMessage())));
                });
    }

    /**
     * Handles the 'search' command.
     * <p>
     * Syntax: search --type TYPE [--branch BRANCH]
     * </p>
     */
    private Mono<ConsoleResponse> handleSearch(CommandParser.ParsedCommand cmd) {
        String type = cmd.getOption("type")
                .or(() -> cmd.getArg(0))
                .orElse(null);
        String branch = cmd.getOption("branch", DEFAULT_BRANCH);

        if (type == null) {
            return Mono.just(ConsoleResponse.error(formatError(
                    "Missing required argument: type\n" +
                    "Usage: search --type TYPE [--branch BRANCH]")));
        }

        return kernelService.search(type.toUpperCase(), branch, java.util.Map.of())
                .collectList()
                .map(results -> {
                    if (results.isEmpty()) {
                        return ConsoleResponse.success(formatWarning("No results found for type: " + type));
                    }
                    var sb = new StringBuilder();
                    sb.append(formatHeader("Search Results: " + type.toUpperCase() + " @ " + branch));
                    sb.append("\n").append(formatInfo("Found " + results.size() + " item(s)"));
                    for (var result : results) {
                        sb.append("\n").append(ANSI_CYAN).append("  • ").append(result).append(ANSI_RESET);
                    }
                    return ConsoleResponse.success(sb.toString());
                })
                .onErrorResume(e -> {
                    log.error("Search failed", e);
                    return Mono.just(ConsoleResponse.error(formatError("Search failed: " + e.getMessage())));
                });
    }

    // ==================== Formatting Helpers ====================

    /**
     * Returns the help text with available commands.
     */
    private String getHelpText() {
        return ANSI_CYAN + ANSI_BOLD +
               """
               ╔═══════════════════════════════════════════════════════════════════════╗
               ║                      UBOS Web Console v1.0.0                          ║
               ║                Universal Business OS - Git for Data                   ║
               ╚═══════════════════════════════════════════════════════════════════════╝
               """ + ANSI_RESET + "\n" +
               ANSI_GREEN + "Available Commands:" + ANSI_RESET + "\n\n" +
               formatCommandHelp("commit", "Record a new snapshot",
                       "commit --type TYPE --slug SLUG --data JSON [--branch BRANCH] [--msg MSG]",
                       "commit LOGIC tax-calc master '{\"rate\":0.1}' \"Initial version\"") +
               formatCommandHelp("show/cat", "Read current snapshot",
                       "show --type TYPE --slug SLUG [--branch BRANCH]",
                       "show LOGIC tax-calc") +
               formatCommandHelp("checkout", "Time travel to a specific commit",
                       "checkout --cid COMMIT_ID",
                       "checkout 101") +
               formatCommandHelp("exists", "Check if a resource exists",
                       "exists --slug SLUG",
                       "exists tax-calc") +
               formatCommandHelp("search", "Search resources by type",
                       "search --type TYPE [--branch BRANCH]",
                       "search LOGIC") +
               formatCommandHelp("help", "Show this help message",
                       "help", null) +
               formatCommandHelp("clear", "Clear the terminal",
                       "clear", null) +
               formatCommandHelp("version", "Show version information",
                       "version", null);
    }

    private String formatCommandHelp(String name, String description, String syntax, String example) {
        var sb = new StringBuilder();
        sb.append(ANSI_YELLOW).append("  ").append(name).append(ANSI_RESET);
        sb.append(" - ").append(description).append("\n");
        sb.append("    ").append(ANSI_CYAN).append("Syntax: ").append(ANSI_RESET).append(syntax).append("\n");
        if (example != null) {
            sb.append("    ").append(ANSI_CYAN).append("Example: ").append(ANSI_RESET).append(example).append("\n");
        }
        sb.append("\n");
        return sb.toString();
    }

    private String formatSuccess(String message) {
        return ANSI_GREEN + "✅ " + message + ANSI_RESET;
    }

    private String formatError(String message) {
        return ANSI_RED + "❌ " + message + ANSI_RESET;
    }

    private String formatWarning(String message) {
        return ANSI_YELLOW + "⚠ " + message + ANSI_RESET;
    }

    private String formatInfo(String message) {
        return ANSI_CYAN + message + ANSI_RESET;
    }

    private String formatHeader(String title) {
        return ANSI_CYAN + ANSI_BOLD + "━━━ " + title + " ━━━" + ANSI_RESET;
    }

    private String prettyPrintJson(String json) {
        try {
            var obj = objectMapper.readValue(json, Object.class);
            return ANSI_CYAN + objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(obj) + ANSI_RESET;
        } catch (JsonProcessingException e) {
            return json;
        }
    }
}
