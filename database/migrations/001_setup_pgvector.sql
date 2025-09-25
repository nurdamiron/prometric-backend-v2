-- Setup pgvector extension for AI embeddings
-- This migration adds vector support for semantic search in AI Brain

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Add vector column to existing knowledge_documents table
-- This will store Vertex AI embeddings (1536 dimensions for gemini-embedding-001, enhanced quality)
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS content_embedding vector(1536);

-- Add vector column to document_chunks table
-- Each chunk will have its own embedding for precise retrieval
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS chunk_embedding vector(1536);

-- Create indexes for vector similarity search
-- Using HNSW (Hierarchical Navigable Small World) for fast approximate search
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_embedding
ON knowledge_documents
USING hnsw (content_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
ON document_chunks
USING hnsw (chunk_embedding vector_cosine_ops);

-- Add metadata columns for embedding tracking
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'gemini-embedding-001',
ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'gemini-embedding-001',
ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create function for similarity search
-- This will be used by the RAG pipeline to find relevant documents
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(1536),
    similarity_threshold real DEFAULT 0.7,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    document_id uuid,
    title text,
    content text,
    similarity real,
    access_level text,
    organization_id uuid
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kd.id as document_id,
        kd.title,
        kd.content,
        1 - (kd.content_embedding <=> query_embedding) as similarity,
        kd.access_level,
        kd.organization_id
    FROM knowledge_documents kd
    WHERE
        kd.content_embedding IS NOT NULL
        AND (1 - (kd.content_embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY kd.content_embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create function for chunk-level similarity search
-- More precise search at chunk level for better RAG results
CREATE OR REPLACE FUNCTION search_similar_chunks(
    query_embedding vector(1536),
    organization_id_filter uuid,
    similarity_threshold real DEFAULT 0.7,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    chunk_id uuid,
    document_id uuid,
    document_title text,
    chunk_content text,
    chunk_index integer,
    similarity real,
    access_level text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id as chunk_id,
        dc.document_id,
        kd.title as document_title,
        dc.content as chunk_content,
        dc.chunk_index,
        1 - (dc.chunk_embedding <=> query_embedding) as similarity,
        kd.access_level
    FROM document_chunks dc
    JOIN knowledge_documents kd ON dc.document_id = kd.id
    WHERE
        dc.chunk_embedding IS NOT NULL
        AND kd.organization_id = organization_id_filter
        AND (1 - (dc.chunk_embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY dc.chunk_embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create hybrid search function (combines keyword + semantic search)
-- Best of both worlds for RAG retrieval
CREATE OR REPLACE FUNCTION hybrid_search_documents(
    query_text text,
    query_embedding vector(1536),
    organization_id_filter uuid,
    similarity_threshold real DEFAULT 0.7,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    document_id uuid,
    title text,
    content text,
    semantic_similarity real,
    text_rank real,
    combined_score real,
    access_level text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kd.id as document_id,
        kd.title,
        kd.content,
        1 - (kd.content_embedding <=> query_embedding) as semantic_similarity,
        ts_rank(to_tsvector('russian', kd.content || ' ' || kd.title), plainto_tsquery('russian', query_text)) as text_rank,
        -- Combined scoring: 70% semantic + 30% keyword matching
        (0.7 * (1 - (kd.content_embedding <=> query_embedding)) +
         0.3 * ts_rank(to_tsvector('russian', kd.content || ' ' || kd.title), plainto_tsquery('russian', query_text))) as combined_score,
        kd.access_level
    FROM knowledge_documents kd
    WHERE
        kd.organization_id = organization_id_filter
        AND kd.content_embedding IS NOT NULL
        AND (
            (1 - (kd.content_embedding <=> query_embedding)) >= similarity_threshold
            OR
            to_tsvector('russian', kd.content || ' ' || kd.title) @@ plainto_tsquery('russian', query_text)
        )
    ORDER BY combined_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create full-text search indexes for hybrid search
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_fts
ON knowledge_documents
USING gin(to_tsvector('russian', content || ' ' || title));

-- Add comments for documentation
COMMENT ON COLUMN knowledge_documents.content_embedding IS 'Vertex AI gemini-embedding-001 vector for semantic search (1536 dimensions)';
COMMENT ON COLUMN document_chunks.chunk_embedding IS 'Vertex AI gemini-embedding-001 vector for chunk-level semantic search (1536 dimensions)';

COMMENT ON FUNCTION search_similar_documents IS 'Find similar documents using vector cosine similarity';
COMMENT ON FUNCTION search_similar_chunks IS 'Find similar document chunks using vector cosine similarity';
COMMENT ON FUNCTION hybrid_search_documents IS 'Combined semantic + keyword search for best RAG results';

-- Grant permissions for application user
-- GRANT EXECUTE ON FUNCTION search_similar_documents TO your_app_user;
-- GRANT EXECUTE ON FUNCTION search_similar_chunks TO your_app_user;
-- GRANT EXECUTE ON FUNCTION hybrid_search_documents TO your_app_user;