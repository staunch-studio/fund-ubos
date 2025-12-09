-- 6. 过程日志 (记录“谁，在什么场景下，发起了这次变更”)
CREATE TABLE lcm_process_commit_log (
    process_id VARCHAR(64) PRIMARY KEY, -- 比如 "PROC_20251129_001"
    process_name VARCHAR(255) NOT NULL, -- 比如 "员工入职流程"
    operator_id VARCHAR(100),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. 过程-实体关联表 (将一次业务操作关联到多个 Commit)
CREATE TABLE lcm_process_entity_map (
    process_id VARCHAR(64) NOT NULL,
    commit_id BIGINT NOT NULL,
    PRIMARY KEY (process_id, commit_id)
);