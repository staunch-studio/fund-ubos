package org.logrum.ubos.server.bootstrap;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class Genesis { 

    private final LcmKernelService kernelService;
    private final ObjectMapper objectMapper;

    private static final String BRANCH_MAIN = "master";
    private static final String AUTHOR_SYSTEM = "system.genesis";

    public Mono<Void> execute() {
        log.info("🌌 [Genesis] Igniting with Pure Data...");

        return Mono.empty()
            .then(commitMetaType())
            .then(commitMoneyType())
            .then(commitDesktopSchema())
            .then(commitGreetingLogic())
            .then(commitAdminUser()) 
            .then();
    }

    
    private Mono<Void> commitMetaType() {
        
        Map<String, Object> data = Map.of(
            "name", "Meta Type Definition",
            "fields", List.of(
                Map.of("name", "slug", "type", "string", "required", true),
                Map.of("name", "schema", "type", "json")
            )
        );
        return internalCommit("TYPE_DEF", "type.meta", data, "Genesis: Meta Type");
    }

    
    private Mono<Void> commitMoneyType() {
        Map<String, Object> data = Map.of(
            "name", "Currency Amount",
            "precision", 2,
            "currency", "USD",
            "validator_ref", "ubos://ctx/logic/validate.money"
        );
        return internalCommit("TYPE_DEF", "type.primitive.money", data, "Genesis: Money Type");
    }

    
    private Mono<Void> commitDesktopSchema() {
        Map<String, Object> data = Map.of(
            "wallpaper", "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070",
            "theme", "dark",
            "icons", List.of(
                
                Map.of(
                    "id", "app_wallet",
                    "title", "我的钱包",
                    "icon", "💰",
                    
                    "ui_schema", Map.of(
                        "type", "v-stack",
                        "children", List.of(
                            Map.of(
                                "type", "text",
                                "props", Map.of("content", "当前余额: $1024.00", "size", "24px", "color", "#4caf50")
                            ),
                            Map.of(
                                "type", "button",
                                "props", Map.of("label", "提现测试", "action", "logic.wallet.withdraw")
                            )
                        )
                    )
                ),
                
                Map.of(
                    "id", "app_store",
                    "title", "应用市场",
                    "icon", "🛍️",
                    "ui_schema", Map.of(
                        "type", "v-stack",
                        "children", List.of(
                            Map.of("type", "text", "props", Map.of("content", "欢迎来到 Logrum Store"))
                        )
                    )
                )
            ),
            "start_menu", List.of("profile", "settings")
        );
        return internalCommit("VIEW", "schema.desktop.default", data, "Genesis: Desktop UI");
    }
    
    private Mono<Void> commitGreetingLogic() {
        String code = """
            if (ctx.hour < 12) return "Good Morning, " + ctx.name
            else return "Good Afternoon, " + ctx.name
        """;

        
        Map<String, Object> data = Map.of(
            "engine", "groovy",
            "content", code
        );
        return internalCommit("LOGIC", "logic.sys.greeting", data, "Genesis: Greeting Logic");
    }

    
    private Mono<Void> commitAdminUser() {
        Map<String, Object> data = Map.of(
            "email", "admin@logrum.org",
            "password", "admin123", 
            "name", "System Administrator",
            "role", "ADMIN",
            "avatar", "https://api.dicebear.com/7.x/bottts/svg?seed=admin"
        );
        
        return internalCommit("USER", "user_admin", data, "Genesis: Admin User");
    }

    
    private Mono<Void> internalCommit(String type, String slug, Map<String, Object> data, String msg) {
        try {
            
            String jsonContent = objectMapper.writeValueAsString(data);

            
            return kernelService.commit(
                type,
                slug,
                BRANCH_MAIN,
                jsonContent,
                AUTHOR_SYSTEM,
                msg
            ).then();

        } catch (JsonProcessingException e) {
            return Mono.error(new RuntimeException("Genesis JSON Error", e));
        }
    }
}