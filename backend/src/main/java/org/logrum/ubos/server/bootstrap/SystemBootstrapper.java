package org.logrum.ubos.server.bootstrap;

import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class SystemBootstrapper implements CommandLineRunner {

    private final Genesis genesis; 
    private final LcmKernelService kernelService;
    private final R2dbcEntityTemplate dbTemplate;

    @Value("${ubos.genesis.strategy:SAFE}")
    private String strategy;

    @Override
    public void run(String... args) {
        log.info("🏁 [Boot] Genesis Strategy: {}", strategy);

        switch (strategy.toUpperCase()) {
            case "RESET":
                
                forceReset().subscribe();
                break;

            case "SAFE":
            default:
                
                kernelService.exists("type.meta")
                    .flatMap(exists -> {
                        if (exists) {
                            log.info("🛡️ [Safe] System already initialized. Skipping Genesis.");
                            return Mono.empty();
                        } else {
                            
                            
                            
                            return genesis.execute()
                                .doOnSuccess(s -> log.info("✅ [Init] First-time Genesis Completed!"));
                        }
                    })
                    .subscribe();
                break;
        }
    }

    public Mono<Void> forceReset() {
        return wipeDatabase()
            .then(genesis.execute()) 
            .doOnSuccess(v -> log.info("♻️ [Force Reset] System has been reset successfully!"))
            .doOnError(e -> log.error("❌ [Force Reset] Failed", e));
    }

    private Mono<Void> wipeDatabase() {
        log.warn("⚠️ [WIPE] Truncating all core tables...");

        
        String sql = """
            TRUNCATE TABLE lcm_entity_version_chain, 
                           lcm_entity_branch_head, 
                           lcm_entity_instance 
            RESTART IDENTITY CASCADE;
        """;

        return dbTemplate.getDatabaseClient().sql(sql).then();
    }
}