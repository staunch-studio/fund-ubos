-- 4. 属性索引表 (让系统具备搜索能力)
CREATE TABLE lcm_entity_search_index (
    id BIGSERIAL PRIMARY KEY,
    commit_id BIGINT NOT NULL, -- 关联到具体的版本
    prop_name VARCHAR(100) NOT NULL,
    val_text TEXT,
    val_num NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 加个索引，加速查询
CREATE INDEX idx_search_prop_val ON lcm_entity_search_index(prop_name, val_text);