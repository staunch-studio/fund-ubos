package org.logrum.ubos.engine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.logrum.ubos.kernel.service.LcmKernelService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.r2dbc.core.DatabaseClient; 
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import jakarta.annotation.PostConstruct;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
public class LcmSchedulerService {

    private final TaskScheduler taskScheduler;
    private final UbosRuntimeService runtimeService;
    private final ObjectMapper objectMapper;
    private final DatabaseClient dbClient; 

    private final Map<String, ScheduledFuture<?>> activeTasks = new ConcurrentHashMap<>();

    
    public LcmSchedulerService(TaskScheduler taskScheduler, UbosRuntimeService runtimeService,
        ObjectMapper objectMapper, DatabaseClient dbClient) {
        this.taskScheduler = taskScheduler;
        this.runtimeService = runtimeService;
        this.objectMapper = objectMapper;
        this.dbClient = dbClient;
    }

    @PostConstruct
    public void init() {
        log.info("⏰ [Bio-Clock] Initializing scheduler...");
        refreshAllTasks();
    }

    public void refreshAllTasks() {
        activeTasks.forEach((slug, future) -> future.cancel(false));
        activeTasks.clear();

        
        String sql = """
            SELECT v.snapshot_data 
            FROM lcm_entity_instance i
            JOIN lcm_entity_branch_head h ON i.id = h.entity_id
            JOIN lcm_entity_version_chain v ON h.head_commit_id = v.commit_id
            WHERE i.entity_type = 'CRON' AND h.branch_name = 'master'
        """;

        dbClient.sql(sql)
            .fetch().all() 
            .doOnNext(this::scheduleTask)
            .subscribe(
                null, 
                error -> log.error("❌ Scheduler initialization failed due to DB error.", error) 
            );
    }

    @SuppressWarnings("unchecked")
    private void scheduleTask(Map<String, Object> snapshot) {
        try {
            
            String contentJson = (String) snapshot.get("snapshot_data"); 
            if (contentJson == null || contentJson.isBlank()) {
                
                return;
            }

            
            Map<String, Object> config = objectMapper.readValue(contentJson, Map.class);

            String cronExpression = (String) config.get("cron");
            String targetLogic = (String) config.get("target");
            Map<String, Object> params = (Map<String, Object>) config.getOrDefault("params", Collections.emptyMap());

            String taskId = targetLogic + "::" + cronExpression;

            if (cronExpression != null && targetLogic != null) {
                ScheduledFuture<?> future = taskScheduler.schedule(
                    () -> executeJob(targetLogic, params),
                    new CronTrigger(cronExpression)
                );

                activeTasks.put(taskId, future);
                log.info("⏰ [Bio-Clock] Task scheduled: [{}] -> [{}]", targetLogic, cronExpression);
            }
        } catch (Exception e) {
            log.error("Failed to schedule task: " + snapshot, e);
        }
    }

    private void executeJob(String logicSlug, Map<String, Object> params) {
        log.info("⏰ [Bio-Clock] Triggering job: {}", logicSlug);
        runtimeService.runLogic(logicSlug, "master", null, params)
            .subscribe(
                result -> log.info("✅ Job [{}] success: {}", logicSlug, result),
                error -> log.error("❌ Job [{}] failed", logicSlug, error)
            );
    }
}