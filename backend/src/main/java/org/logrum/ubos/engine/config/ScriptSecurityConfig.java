package org.logrum.ubos.engine.config;

import groovy.transform.ThreadInterrupt;
import org.codehaus.groovy.control.CompilerConfiguration;
import org.codehaus.groovy.control.customizers.ASTTransformationCustomizer;
import org.codehaus.groovy.control.customizers.SecureASTCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class ScriptSecurityConfig {

    @Bean
    public CompilerConfiguration secureCompilerConfig() {
        SecureASTCustomizer secure = new SecureASTCustomizer();

        secure.setDisallowedReceivers(List.of(
            
            "java.lang.Runtime",
            "java.lang.Class",
            "java.lang.ClassLoader",
            "java.lang.ProcessBuilder",
            "java.lang.Thread",
            "java.lang.ThreadGroup"
        ));

        secure.setDisallowedImports(List.of(
            "java.io.File",
            "java.io.FileInputStream",
            "java.io.FileOutputStream",
            "java.nio.*",
            "java.net.Socket",
            "java.net.ServerSocket",
            "java.sql.*",
            "java.util.concurrent.*",
            "java.lang.reflect.*"
        ));

        secure.setMethodDefinitionAllowed(false);
        CompilerConfiguration config = new CompilerConfiguration();
        config.addCompilationCustomizers(secure);
        config.addCompilationCustomizers(new ASTTransformationCustomizer(ThreadInterrupt.class));

        return config;
    }
}