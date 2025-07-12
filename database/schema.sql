-- StoryForge Database Schema

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Story sessions table - tracks user's progress through stories
CREATE TABLE story_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id VARCHAR(100) NOT NULL, -- matches backend story IDs
    session_name VARCHAR(255), -- user-defined name for this playthrough
    status VARCHAR(20) DEFAULT 'active', -- active, completed, abandoned
    
    -- AI-generated summaries
    story_summary TEXT, -- AI-generated summary of what happened
    key_events JSONB, -- important story beats/decisions
    character_relationships JSONB, -- how relationships have evolved
    
    -- Session metadata
    total_messages INTEGER DEFAULT 0,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message history for each session
CREATE TABLE session_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES story_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    metadata JSONB, -- RAG context, choices, etc.
    message_order INTEGER NOT NULL, -- sequence within session
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_story_sessions_user_id ON story_sessions(user_id);
CREATE INDEX idx_story_sessions_story_id ON story_sessions(story_id);
CREATE INDEX idx_story_sessions_status ON story_sessions(status);
CREATE INDEX idx_session_messages_session_id ON session_messages(session_id);
CREATE INDEX idx_session_messages_order ON session_messages(session_id, message_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_sessions_updated_at BEFORE UPDATE ON story_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();