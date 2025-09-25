-- Migration: Remove pgvector columns and use Vertex AI Vector Search
-- PostgreSQL will only store metadata, vectors go to Vertex AI Vector Search

-- Drop existing vector indexes and columns
DROP INDEX IF EXISTS idx_knowledge_documents_embedding;
DROP INDEX IF EXISTS idx_document_chunks_embedding;

-- Remove vector columns (we'll use Vertex AI Vector Search instead)
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS content_embedding;
ALTER TABLE document_chunks DROP COLUMN IF EXISTS chunk_embedding;

-- Keep only metadata columns for tracking embeddings
-- ALTER TABLE knowledge_documents - embedding_model, embedding_created_at, embedding_tokens stay
-- ALTER TABLE document_chunks - embedding_model, embedding_created_at, embedding_tokens stay

-- Drop vector search functions (no longer needed)
DROP FUNCTION IF EXISTS search_similar_documents;
DROP FUNCTION IF EXISTS search_similar_chunks;
DROP FUNCTION IF EXISTS hybrid_search_documents;

-- Add new columns for Vertex AI Vector Search tracking
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS vector_index_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS vector_search_status VARCHAR(50) DEFAULT 'pending';

-- Add organization-level Vector Search tracking
CREATE TABLE IF NOT EXISTS vector_search_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  index_name VARCHAR(200) NOT NULL UNIQUE,
  index_endpoint VARCHAR(500),
  status VARCHAR(50) DEFAULT 'creating', -- creating, ready, error, deleted
  dimensions INTEGER DEFAULT 768,
  total_vectors INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync_at TIMESTAMP,

  CONSTRAINT unique_org_index UNIQUE (organization_id, index_name)
);

-- Create index for vector search tracking
CREATE INDEX idx_vector_indexes_org ON vector_search_indexes(organization_id);
CREATE INDEX idx_vector_indexes_status ON vector_search_indexes(status);

-- Add comments
COMMENT ON TABLE vector_search_indexes IS 'Tracks Vertex AI Vector Search indexes for each organization';
COMMENT ON COLUMN knowledge_documents.vector_index_name IS 'Reference to Vertex AI Vector Search index';
COMMENT ON COLUMN knowledge_documents.vector_search_status IS 'Status of document in Vector Search (pending, indexed, error)';

-- Verify migration
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('knowledge_documents', 'vector_search_indexes')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;