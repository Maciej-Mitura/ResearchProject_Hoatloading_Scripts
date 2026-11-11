-- Timestamp ties (including multiple reviews within one transaction) must not
-- select a random UUID as the latest approval. Preserve the original records.
ALTER TABLE script_capability_reviews ADD COLUMN review_order BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX capability_review_order_unique ON script_capability_reviews(review_order);
CREATE INDEX capability_review_latest ON script_capability_reviews(manifest_id, review_order DESC);
