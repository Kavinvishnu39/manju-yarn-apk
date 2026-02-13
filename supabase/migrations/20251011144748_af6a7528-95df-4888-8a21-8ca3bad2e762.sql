-- Create lots table for yarn inventory
CREATE TABLE public.lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number TEXT NOT NULL UNIQUE,
  count TEXT NOT NULL,
  shade TEXT,
  cones INTEGER DEFAULT 0,
  weight DECIMAL(10, 2) NOT NULL CHECK (weight >= 0),
  price_per_kg DECIMAL(10, 2) NOT NULL CHECK (price_per_kg >= 0),
  image_url TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create sales table for transactions
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  count TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  weight_sold DECIMAL(10, 2) NOT NULL CHECK (weight_sold > 0),
  price_per_kg DECIMAL(10, 2) NOT NULL CHECK (price_per_kg >= 0),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lots table
CREATE POLICY "Users can view their own lots"
  ON public.lots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lots"
  ON public.lots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lots"
  ON public.lots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lots"
  ON public.lots FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sales table
CREATE POLICY "Users can view their own sales"
  ON public.sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales"
  ON public.sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales"
  ON public.sales FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lots updated_at
CREATE TRIGGER set_lots_updated_at
  BEFORE UPDATE ON public.lots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;

-- Create indexes for better performance
CREATE INDEX idx_lots_lot_number ON public.lots(lot_number);
CREATE INDEX idx_lots_user_id ON public.lots(user_id);
CREATE INDEX idx_lots_weight ON public.lots(weight);
CREATE INDEX idx_sales_lot_id ON public.sales(lot_id);
CREATE INDEX idx_sales_user_id ON public.sales(user_id);
CREATE INDEX idx_sales_sale_date ON public.sales(sale_date);