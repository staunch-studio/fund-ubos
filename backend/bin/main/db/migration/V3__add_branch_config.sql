-- 5. 分支配置表 (定义分支间的继承关系)
CREATE TABLE sys_branch_config (
    branch_name VARCHAR(100) PRIMARY KEY,
    parent_branch VARCHAR(100), -- 如果为空，说明是根分支(Root)
    description VARCHAR(255)
);

-- 初始化数据：定义 beijing 继承自 master
INSERT INTO sys_branch_config (branch_name, parent_branch, description)
VALUES ('master', NULL, 'Global Root');

INSERT INTO sys_branch_config (branch_name, parent_branch, description)
VALUES ('beijing', 'master', 'Beijing Branch inherits from Master');