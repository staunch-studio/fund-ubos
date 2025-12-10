package org.logrum.ubos.kernel.util;

/**
 * Custom exception thrown when a UBOS URI cannot be parsed.
 */
public class UbosUriParseException extends RuntimeException {

    public UbosUriParseException(String message) {
        super(message);
    }

    public UbosUriParseException(String message, Throwable cause) {
        super(message, cause);
    }
}
