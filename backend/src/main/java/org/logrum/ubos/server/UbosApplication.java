package org.logrum.ubos.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.r2dbc.repository.config.EnableR2dbcRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;
import lombok.extern.slf4j.Slf4j;

@SpringBootApplication
@ComponentScan(basePackages = "org.logrum.ubos")
@EnableR2dbcRepositories(basePackages = "org.logrum.ubos.kernel.repository")
@EnableScheduling
@Slf4j
public class UbosApplication {

    public static void main(String[] args) {
        SpringApplication.run(UbosApplication.class, args);
        log.info("UBOS (Universal Business OS) Started Successfully!");
    }
}