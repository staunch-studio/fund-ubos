package org.logrum.ubos.web.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;

@Component
public class LocalhostSecurityFilter implements WebFilter {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        // 保护 /api/console 路径
        if (path.startsWith("/api/console")) {
            InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
            if (remoteAddress != null) {
                String ip = remoteAddress.getAddress().getHostAddress();
                // 允许 IPv4 (127.0.0.1) 和 IPv6 (0:0:0:0:0:0:0:1) 本地回环
                if (!"127.0.0.1".equals(ip) && !"0:0:0:0:0:0:0:1".equals(ip)) {
                    exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
                    return exchange.getResponse().writeWith(
                        Mono.just(exchange.getResponse().bufferFactory().wrap("⛔ Access Denied: Localhost Only.".getBytes()))
                    );
                }
            }
        }
        return chain.filter(exchange);
    }
}