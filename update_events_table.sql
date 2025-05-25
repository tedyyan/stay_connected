-- First, make the contacts column nullable
ALTER TABLE public.events ALTER COLUMN contacts DROP NOT NULL;

-- Set a default empty array for existing records
UPDATE public.events SET contacts = '[]'::jsonb WHERE contacts IS NULL;

-- Later, after confirming everything works, you can remove the column with:
-- ALTER TABLE public.events DROP COLUMN contacts; 