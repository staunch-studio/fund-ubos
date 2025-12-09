package org.logrum.ubos.kernel.util;

import io.r2dbc.spi.R2dbcException;
import org.springframework.dao.TransientDataAccessResourceException;
import reactor.util.retry.Retry;

import java.time.Duration;

public final class ReactiveRetry {

    private ReactiveRetry() {} 

    public static Retry databaseTransientErrors() {
        return Retry.backoff(3, Duration.ofSeconds(1))
            .filter(ReactiveRetry::isTransientError) 
            .onRetryExhaustedThrow((retryBackoffSpec, retrySignal) ->
                new RuntimeException("UBOS Database resilience exhausted after " +
                                     retrySignal.totalRetries() + " attempts.", retrySignal.failure())
            );
    }

    private static boolean isTransientError(Throwable throwable) {
        
        if (throwable instanceof TransientDataAccessResourceException) {
            return true;
        }
        
        if (throwable instanceof R2dbcException) {
            return true;
        }
        
        if (throwable.getMessage() != null && throwable.getMessage().contains("Connection reset")) {
            return true;
        }

        
        return false;
    }
}