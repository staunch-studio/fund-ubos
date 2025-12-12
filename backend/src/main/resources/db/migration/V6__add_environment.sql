-- Environment Configuration Table
-- Maps running environments (UAT, PROD, etc.) to specific UBOS states (Branch/Commit)
CREATE TABLE sys_environment_config (
    env_name VARCHAR(50) PRIMARY KEY,
    mapped_branch VARCHAR(100) NOT NULL DEFAULT 'master',
    mapped_commit_id BIGINT,  -- Optional: pin to a specific commit for stable testing
    description VARCHAR(255),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Foreign key to ensure mapped_commit_id is valid (if provided)
    CONSTRAINT fk_env_commit FOREIGN KEY (mapped_commit_id) 
        REFERENCES lcm_entity_version_chain(commit_id) ON DELETE SET NULL
);

-- Initial environment configurations
INSERT INTO sys_environment_config (env_name, mapped_branch, description) VALUES
    ('DEV', 'master', 'Development environment - latest master branch'),
    ('UAT', 'master', 'User Acceptance Testing environment'),
    ('STAGING', 'master', 'Pre-production staging environment'),
    ('PROD', 'master', 'Production environment');

-- Create index for quick lookups
CREATE INDEX idx_env_config_branch ON sys_environment_config(mapped_branch);



CREATE INDEX IF NOT EXISTS idx_version_chain_entity_commit
ON lcm_entity_version_chain(entity_id, commit_id);
