package org.logrum.ubos.server.controller.console;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses raw command strings into structured command objects.
 * <p>
 * Supports both positional arguments and named options (--key value).
 * Handles quoted strings containing spaces.
 * </p>
 */
public final class CommandParser {

    private CommandParser() {
        // Utility class
    }

    /**
     * Parsed command representation.
     *
     * @param name       the command name
     * @param args       positional arguments
     * @param options    named options (--key value pairs)
     * @param rawCommand the original command string
     */
    public record ParsedCommand(
            String name,
            List<String> args,
            Map<String, String> options,
            String rawCommand
    ) {
        /**
         * Gets an option value or default.
         *
         * @param key          the option key
         * @param defaultValue default value if not present
         * @return the option value or default
         */
        public String getOption(String key, String defaultValue) {
            return options.getOrDefault(key, defaultValue);
        }

        /**
         * Gets an option value as Optional.
         *
         * @param key the option key
         * @return Optional containing the value if present
         */
        public Optional<String> getOption(String key) {
            return Optional.ofNullable(options.get(key));
        }

        /**
         * Gets a positional argument by index.
         *
         * @param index the argument index
         * @return Optional containing the argument if present
         */
        public Optional<String> getArg(int index) {
            if (index >= 0 && index < args.size()) {
                return Optional.of(args.get(index));
            }
            return Optional.empty();
        }
    }

    /**
     * Parses a raw command string.
     *
     * @param commandLine the raw command line
     * @return ParsedCommand containing structured data
     * @throws IllegalArgumentException if command is empty or invalid
     */
    public static ParsedCommand parse(String commandLine) {
        if (commandLine == null || commandLine.isBlank()) {
            throw new IllegalArgumentException("Command cannot be empty");
        }

        var tokens = tokenize(commandLine.trim());
        if (tokens.isEmpty()) {
            throw new IllegalArgumentException("Command cannot be empty");
        }

        var name = tokens.get(0).toLowerCase();  // Changed from getFirst() to get(0)
        var args = new ArrayList<String>();
        var options = new HashMap<String, String>();

        for (int i = 1; i < tokens.size(); i++) {
            var token = tokens.get(i);
            if (token.startsWith("--")) {
                var key = token.substring(2);
                if (i + 1 < tokens.size() && !tokens.get(i + 1).startsWith("--")) {
                    options.put(key, tokens.get(++i));
                } else {
                    options.put(key, "true"); // Flag without value
                }
            } else if (token.startsWith("-")) {
                var key = token.substring(1);
                if (i + 1 < tokens.size() && !tokens.get(i + 1).startsWith("-")) {
                    options.put(key, tokens.get(++i));
                } else {
                    options.put(key, "true");
                }
            } else {
                args.add(token);
            }
        }

        return new ParsedCommand(name, args, options, commandLine);
    }

    /**
     * Tokenizes a command line, respecting quoted strings.
     *
     * @param input the input string
     * @return list of tokens
     */
    private static List<String> tokenize(String input) {
        var tokens = new ArrayList<String>();
        // Pattern matches: quoted strings (single or double) or non-space sequences
        var pattern = Pattern.compile("\"([^\"]*)\"|'([^']*)'|(\\S+)");
        var matcher = pattern.matcher(input);

        while (matcher.find()) {
            if (matcher.group(1) != null) {
                tokens.add(matcher.group(1)); // Double-quoted string
            } else if (matcher.group(2) != null) {
                tokens.add(matcher.group(2)); // Single-quoted string
            } else if (matcher.group(3) != null) {
                tokens.add(matcher.group(3)); // Unquoted token
            }
        }

        return tokens;
    }
}
