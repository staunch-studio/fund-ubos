-- 1. 实体注册表 (不管版本，只管存在)
CREATE TABLE lcm_entity_instance (
    id VARCHAR(64) PRIMARY KEY, -- UUID
    entity_type VARCHAR(50) NOT NULL, -- 'LOGIC', 'VIEW', 'DATA'
    slug VARCHAR(255) NOT NULL, -- 业务唯一标识，如 'logic.calc.tax'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entity_type, slug)
);

-- 2. 版本链表 (核心存储，Git Commit Node)
CREATE TABLE lcm_entity_version_chain (
    commit_id BIGSERIAL PRIMARY KEY, -- 自增ID作为提交号
    entity_id VARCHAR(64) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    parent_commit_id BIGINT, -- 指向父节点
    snapshot_data TEXT NOT NULL, -- JSON 格式的全量数据
    author_id VARCHAR(64),
    message VARCHAR(255),
    committed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 分支指针表 (类似 Git 的 Refs)
CREATE TABLE lcm_entity_branch_head (
    entity_id VARCHAR(64) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    head_commit_id BIGINT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_id, branch_name)
);