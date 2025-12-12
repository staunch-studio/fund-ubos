package org.logrum.ubos.kernel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.logrum.ubos.web.console.dto.MergeConflictResult;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;

@Service
@RequiredArgsConstructor
public class LcmMergeConflictService {

    private final ObjectMapper objectMapper;
    private final UbosResourceResolverService ubosResolver;

    /**
     * Inputs may be raw JSON strings or ubos:// URIs.
     */
    public Mono<MergeConflictResult> detectConflictsFromInputs(String baseInput, String oursInput, String theirsInput) {
        return Mono.zip(
                resolveToJsonString(baseInput),
                resolveToJsonString(oursInput),
                resolveToJsonString(theirsInput)
            )
            .flatMap(t -> detectConflicts(t.getT1(), t.getT2(), t.getT3()));
    }

    /**
     * Detect conflicts between three JSON documents (base/ours/theirs).
     * Non-blocking: CPU work is deferred; no I/O occurs here.
     */
    public Mono<MergeConflictResult> detectConflicts(String baseJson, String oursJson, String theirsJson) {
        return Mono.fromSupplier(() -> {
            try {
                JsonNode base = objectMapper.readTree(nullToEmptyObject(baseJson));
                JsonNode ours = objectMapper.readTree(nullToEmptyObject(oursJson));
                JsonNode theirs = objectMapper.readTree(nullToEmptyObject(theirsJson));

                Map<String, MergeConflictResult.ConflictTriplet> conflicts = new LinkedHashMap<>();
                ObjectNode merged = computeMergedOrConflicts(base, ours, theirs, conflicts);

                if (!conflicts.isEmpty()) {
                    return MergeConflictResult.conflict(conflicts);
                }
                return MergeConflictResult.autoMerged(objectMapper.writeValueAsString(merged));
            } catch (Exception e) {
                throw new IllegalArgumentException("Failed to detect conflicts: " + e.getMessage(), e);
            }
        });
    }

    private Mono<String> resolveToJsonString(String input) {
        if (input == null || input.isBlank()) {
            return Mono.just("{}");
        }
        String trimmed = input.trim();
        if (trimmed.regionMatches(true, 0, "ubos://", 0, "ubos://".length())) {
            // Important: this is internal resolution, not HTTP.
            return ubosResolver.resolve(trimmed)
                .map(obj -> {
                    try {
                        return objectMapper.writeValueAsString(obj);
                    } catch (Exception e) {
                        throw new IllegalStateException("Failed to serialize resolved UBOS object to JSON", e);
                    }
                });
        }
        return Mono.just(trimmed);
    }

    /**
     * Produces merged result if conflict-free; otherwise fills conflicts map.
     * Merge strategy: per-path 3-way merge for objects; arrays/scalars are atomic.
     */
    private ObjectNode computeMergedOrConflicts(
        JsonNode base,
        JsonNode ours,
        JsonNode theirs,
        Map<String, MergeConflictResult.ConflictTriplet> conflicts
    ) {
        ObjectNode merged = objectMapper.createObjectNode();

        if (!base.isObject() || !ours.isObject() || !theirs.isObject()) {
            // Treat non-objects atomically at root.
            boolean oursChanged = !jsonEquals(ours, base);
            boolean theirsChanged = !jsonEquals(theirs, base);

            if (oursChanged && theirsChanged && !jsonEquals(ours, theirs)) {
                conflicts.put("", new MergeConflictResult.ConflictTriplet(
                    toJava(base), toJava(ours), toJava(theirs)
                ));
                return merged;
            }
            JsonNode chosen = oursChanged ? ours : (theirsChanged ? theirs : base);
            if (chosen.isObject()) {
                return (ObjectNode) chosen.deepCopy();
            }
            merged.set("value", chosen);
            return merged;
        }

        mergeObjectRecursive("", (ObjectNode) base, (ObjectNode) ours, (ObjectNode) theirs, merged, conflicts);
        return merged;
    }

    private void mergeObjectRecursive(
        String path,
        ObjectNode base,
        ObjectNode ours,
        ObjectNode theirs,
        ObjectNode out,
        Map<String, MergeConflictResult.ConflictTriplet> conflicts
    ) {
        TreeSet<String> fields = new TreeSet<>();
        collectFieldNames(base, fields);
        collectFieldNames(ours, fields);
        collectFieldNames(theirs, fields);

        for (String f : fields) {
            String p = path.isEmpty() ? f : path + "." + f;

            JsonNode b = base.get(f);
            JsonNode o = ours.get(f);
            JsonNode t = theirs.get(f);

            if (b == null) b = objectMapper.nullNode();
            if (o == null) o = objectMapper.nullNode();
            if (t == null) t = objectMapper.nullNode();

            // If all are objects -> recurse
            if (b.isObject() && o.isObject() && t.isObject()) {
                ObjectNode childOut = objectMapper.createObjectNode();
                mergeObjectRecursive(p, (ObjectNode) b, (ObjectNode) o, (ObjectNode) t, childOut, conflicts);

                // If recursion produced an empty object but originals weren't all empty, we still set it
                out.set(f, childOut);
                continue;
            }

            // Arrays/scalars/null treated atomically
            boolean oursChanged = !jsonEquals(o, b);
            boolean theirsChanged = !jsonEquals(t, b);

            if (oursChanged && theirsChanged && !jsonEquals(o, t)) {
                conflicts.put(p, new MergeConflictResult.ConflictTriplet(toJava(b), toJava(o), toJava(t)));
                continue;
            }

            JsonNode chosen;
            if (oursChanged) {
                chosen = o;
            } else if (theirsChanged) {
                chosen = t;
            } else {
                chosen = b;
            }

            // If chosen is explicit null, we still set it (represents deletion)
            out.set(f, chosen);
        }
    }

    private void collectFieldNames(ObjectNode node, TreeSet<String> out) {
        if (node == null) return;
        Iterator<String> it = node.fieldNames();
        while (it.hasNext()) out.add(it.next());
    }

    private boolean jsonEquals(JsonNode a, JsonNode b) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }

    private Object toJava(JsonNode n) {
        if (n == null || n.isNull() || n.isMissingNode()) return null;
        return objectMapper.convertValue(n, Object.class);
    }

    private String nullToEmptyObject(String json) {
        if (json == null || json.isBlank()) return "{}";
        return json;
    }
}
