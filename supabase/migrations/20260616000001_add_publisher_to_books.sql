-- Add publisher and KICD approval tracking to generic books table
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS publisher VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_kicd_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS isbn VARCHAR(50);
