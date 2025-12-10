package org.logrum.ubos.server.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Jackson ObjectMapper configuration for consistent JSON serialization.
 * <p>
 * This configuration ensures that all JSON output uses standard Java camelCase naming,
 * preventing any automatic conversion to snake_case.
 */
@Configuration
public class JacksonConfig {

    /**
     * Configures the primary ObjectMapper bean for the application.
     * <p>
     * Key settings:
     * <ul>
     *   <li>Uses LOWER_CAMEL_CASE naming strategy to ensure fields like {@code commitId} 
     *       are serialized as "commitId" (not "commit_id")</li>
     *   <li>Registers JavaTimeModule for proper Java 8 date/time handling</li>
     *   <li>Disables timestamp format for dates (uses ISO-8601 string format instead)</li>
     * </ul>
     *
     * @return the configured ObjectMapper instance
     */
    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        
        // Ensure Java camelCase is preserved in JSON output (e.g., commitId -> "commitId")
        mapper.setPropertyNamingStrategy(PropertyNamingStrategies.LOWER_CAMEL_CASE);
        
        // Register Java 8 date/time module for LocalDateTime support
        mapper.registerModule(new JavaTimeModule());
        
        // Use ISO-8601 string format for dates instead of timestamps
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        
        return mapper;
    }
}
