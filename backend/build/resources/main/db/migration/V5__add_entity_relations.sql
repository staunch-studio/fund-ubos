-- 8. 实体关系表 (存储所有实体间的连接)
-- 语句 A: 创建表
CREATE TABLE lcm_entity_relation (
    id BIGSERIAL PRIMARY KEY,
    source_entity_id VARCHAR(64) NOT NULL REFERENCES lcm_entity_instance(id),
    target_entity_id VARCHAR(64) NOT NULL REFERENCES lcm_entity_instance(id),
    relation_type VARCHAR(100) NOT NULL, -- 关系类型，如 "OWNS", "BELONGS_TO", "APPROVES"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 语句 B: 创建索引 (必须是单独的语句)
CREATE INDEX idx_rel_source_type
ON lcm_entity_relation(source_entity_id, relation_type);