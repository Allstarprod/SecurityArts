-- Add the CDN image URL column used by the Supabase Storage blob store.
-- (Already applied to project ixdkfakibuctwhgwngsw.)
ALTER TABLE works ADD COLUMN IF NOT EXISTS img_url TEXT;
