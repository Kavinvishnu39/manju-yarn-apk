-- Create storage bucket for lot images
INSERT INTO storage.buckets (id, name, public)
VALUES ('lot-images', 'lot-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for lot-images bucket
CREATE POLICY "Users can view lot images"
ON storage.objects FOR SELECT
USING (bucket_id = 'lot-images');

CREATE POLICY "Users can upload their own lot images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lot-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own lot images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'lot-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own lot images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lot-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);