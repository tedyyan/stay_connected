-- Update events table status constraint to match requirements

-- Step 1: Update existing 'active' status to 'running' to match requirements
UPDATE events 
SET status = 'running' 
WHERE status = 'active';

-- Step 2: Update any other invalid status values to 'running'
UPDATE events 
SET status = 'running' 
WHERE status IS NULL OR status NOT IN ('running', 'triggered', 'paused');

-- Step 3: Drop the existing constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;

-- Step 4: Add the new constraint with correct status options
ALTER TABLE events ADD CONSTRAINT events_status_check 
CHECK (status IN ('running', 'triggered', 'paused'));

-- Step 5: Update default status to 'running'
ALTER TABLE events ALTER COLUMN status SET DEFAULT 'running';
