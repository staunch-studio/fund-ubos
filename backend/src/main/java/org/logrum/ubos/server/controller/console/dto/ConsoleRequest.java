package org.logrum.ubos.server.controller.console.dto;

/**
 * Request body for console command execution.
 *
 * @param command the raw command string to execute
 */
public record ConsoleRequest(String command) {
}
