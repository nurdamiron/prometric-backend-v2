-- AI Knowledge Base with pgvector for semantic search
-- Migration: 003_add_pgvector_knowledge_base.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_documents table for AI knowledge base
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Document metadata
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('website', 'instagram', 'manual', 'upload')),
  source_url VARCHAR(1000),
  access_level VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (access_level IN ('public', 'confidential', 'restricted')),
  language VARCHAR(5) NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'kz', 'en')),

  -- AI processing data
  word_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  embedding vector(1536), -- OpenAI ada-002 embedding size

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_knowledge_org_id (organization_id),
  INDEX idx_knowledge_source (source),
  INDEX idx_knowledge_access_level (access_level),
  INDEX idx_knowledge_language (language),
  INDEX idx_knowledge_created_by (created_by)
);

-- Vector similarity index for semantic search
CREATE INDEX idx_knowledge_embedding ON knowledge_documents USING ivfflat (embedding vector_cosine_ops);

-- Create document_chunks table for chunked content
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Chunk data
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),

  -- Metadata
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_chunks_document_id (document_id),
  INDEX idx_chunks_org_id (organization_id),
  INDEX idx_chunks_index (chunk_index)
);

-- Vector similarity index for chunk search
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Create ai_interactions table for conversation history
CREATE TABLE ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Conversation data
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  context VARCHAR(100),

  -- AI metadata
  model_used VARCHAR(100),
  tokens_used INTEGER DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,
  function_calls JSONB,

  -- Quality metrics
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  was_helpful BOOLEAN,

  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_interactions_user_id (user_id),
  INDEX idx_interactions_org_id (organization_id),
  INDEX idx_interactions_created_at (created_at),
  INDEX idx_interactions_model (model_used)
);

-- Create ai_function_executions table for tracking AI actions
CREATE TABLE ai_function_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID REFERENCES ai_interactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Function data
  function_name VARCHAR(100) NOT NULL,
  parameters JSONB NOT NULL,
  result JSONB,

  -- Execution metadata
  execution_time_ms INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'error', 'permission_denied')),
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_function_exec_user_id (user_id),
  INDEX idx_function_exec_org_id (organization_id),
  INDEX idx_function_exec_function (function_name),
  INDEX idx_function_exec_status (status)
);

-- Comments for documentation
COMMENT ON TABLE knowledge_documents IS 'AI knowledge base documents with vector embeddings for RAG';
COMMENT ON TABLE document_chunks IS 'Chunked document content for efficient semantic search';
COMMENT ON TABLE ai_interactions IS 'AI conversation history for analytics and improvements';
COMMENT ON TABLE ai_function_executions IS 'AI function calling execution logs for audit and debugging';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_documents TO prometric_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks TO prometric_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_interactions TO prometric_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_function_executions TO prometric_app;