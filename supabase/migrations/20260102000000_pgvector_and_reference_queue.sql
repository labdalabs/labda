-- pgvector for Reference embeddings (issue #6) and the pgmq queue that the
-- Nest reference-embedding worker polls.
--
-- vector   — pgvector extension; provides the `vector` column type used by the
--            Reference.embedding column (semantic search / clustering).

create extension if not exists vector;

-- Queue consumed by the `reference.embed` @QueueHandler in libs/core/research.
-- Attaching a Reference enqueues { referenceId } here; the worker computes the
-- embedding and writes it back to the row.
select pgmq.create('reference.embed');
