package org.logrum.ubos.server.controller.console.dto;

/**
 * Response body for console command execution.
 *
 * @param output   the command output (may contain ANSI color codes)
 * @param success  whether the command executed successfully
 * @param exitCode exit code (0 for success, non-zero for errors)
 */
public record ConsoleResponse(
        String output,
        boolean success,
        int exitCode
) {
    /**
     * Creates a successful response.
     *
     * @param output the output message
     * @return a success response
     */
    public static ConsoleResponse success(String output) {
        return new ConsoleResponse(output, true, 0);
    }

    /**
     * Creates an error response.
     *
     * @param output the error message
     * @return an error response
     */
    public static ConsoleResponse error(String output) {
        return new ConsoleResponse(output, false, 1);
    }
}
