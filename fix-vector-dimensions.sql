-- Fix vector dimensions for gemini-embedding-001 (3072 dimensions)

-- Drop existing vector columns and indexes
DROP INDEX IF EXISTS idx_knowledge_documents_embedding;
DROP INDEX IF EXISTS idx_document_chunks_embedding;

ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS content_embedding;
ALTER TABLE document_chunks DROP COLUMN IF EXISTS chunk_embedding;

-- Add new vector columns with correct dimensions
ALTER TABLE knowledge_documents
ADD COLUMN content_embedding vector(3072);

ALTER TABLE document_chunks
ADD COLUMN chunk_embedding vector(3072);

-- Recreate indexes
CREATE INDEX idx_knowledge_documents_embedding
ON knowledge_documents
USING hnsw (content_embedding vector_cosine_ops);

CREATE INDEX idx_document_chunks_embedding
ON document_chunks
USING hnsw (chunk_embedding vector_cosine_ops);

-- Verify schema
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'knowledge_documents'
AND column_name LIKE '%embedding%';