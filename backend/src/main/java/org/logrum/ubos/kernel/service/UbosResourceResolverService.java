package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.logrum.ubos.kernel.util.UbosUriUtil;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Iterator;

@Slf4j
@Service
@RequiredArgsConstructor
public class UbosResourceResolverService {

    private final LcmKernelService kernelService;
    private final ObjectMapper objectMapper;

    /**
     * Resolve a ubos:// URI into the actual data object (JSON decoded).
     *
     * <p>Resolution rules:
     * <ul>
     *   <li>If commit is present -> fetch snapshot at that commit</li>
     *   <li>Else -> fetch HEAD snapshot of the branch (tenant-aware using scope)</li>
     *   <li>If key is present -> return only that extracted value</li>
     * </ul>
     */
    public Mono<Object> resolve(String ubosUriString) {
        if (ubosUriString == null || ubosUriString.isBlank()) {
            return Mono.error(new IllegalArgumentException("ubosUriString is required"));
        }

        final UbosUriUtil.UbosUriDetails details;
        try {
            details = UbosUriUtil.parse(ubosUriString);
        } catch (RuntimeException e) {
            return Mono.error(new IllegalArgumentException("Invalid UBOS URI: " + e.getMessage(), e));
        }

        Mono<String> snapshotMono;
        if (details.hasCommitId()) {
            snapshotMono = kernelService.getSnapshotByCommit(details.commitId());
        } else {
            // IMPORTANT: scope is treated as tenantId here (tenant-aware resolution)
            snapshotMono = kernelService.getResourceSnapshot(ubosUriString, details.scope());
        }

        return snapshotMono
            .switchIfEmpty(Mono.error(new IllegalArgumentException("Resource not found for: " + ubosUriString)))
            .flatMap(json -> {
                try {
                    JsonNode root = objectMapper.readTree(json);

                    if (details.hasKey()) {
                        JsonNode extracted = extractByKeyPath(root, details.key());
                        if (extracted == null || extracted.isMissingNode() || extracted.isNull()) {
                            return Mono.error(new IllegalArgumentException(
                                "Key not found: '" + details.key() + "' in " + ubosUriString
                            ));
                        }
                        return Mono.just(objectMapper.convertValue(extracted, Object.class));
                    }

                    return Mono.just(objectMapper.convertValue(root, Object.class));
                } catch (Exception e) {
                    return Mono.error(new IllegalStateException("Failed to parse resolved JSON snapshot", e));
                }
            });
    }

    /**
     * Extract a value from a JSON tree using dot notation, e.g. "feature_flags.ai_enabled".
     * Supports numeric segments for arrays, e.g. "items.0.name".
     */
    private JsonNode extractByKeyPath(JsonNode root, String keyPath) {
        if (root == null) return null;
        if (keyPath == null || keyPath.isBlank()) return root;

        String[] parts = keyPath.split("\\.");
        JsonNode current = root;

        for (String part : parts) {
            if (current == null || current.isMissingNode() || current.isNull()) {
                return current;
            }

            if (current.isArray()) {
                Integer idx = tryParseInt(part);
                if (idx == null || idx < 0 || idx >= current.size()) {
                    return objectMapper.getNodeFactory().missingNode();
                }
                current = current.get(idx);
                continue;
            }

            if (current.isObject()) {
                current = current.get(part);
                if (current == null) {
                    return objectMapper.getNodeFactory().missingNode();
                }
                continue;
            }

            // scalar encountered before the path ends
            return objectMapper.getNodeFactory().missingNode();
        }

        return current;
    }

    private Integer tryParseInt(String s) {
        try {
            return Integer.valueOf(s);
        } catch (Exception ignored) {
            return null;
        }
    }
}
