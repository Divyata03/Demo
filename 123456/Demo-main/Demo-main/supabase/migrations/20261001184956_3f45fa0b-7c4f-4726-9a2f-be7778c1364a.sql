CREATE TYPE public.campus_role AS ENUM ('student','teacher','security','cleaning_staff','other_staff');
CREATE TYPE public.item_kind AS ENUM ('lost','found');
CREATE TYPE public.item_status AS ENUM ('open','claimed','returned');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  college_email text NOT NULL,
  campus_role public.campus_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, college_email, campus_role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'campus_role')::public.campus_role, 'student')
  );
  RETURN NEW;
EXCEPTION WHEN invalid_text_representation THEN
  INSERT INTO public.profiles (id, full_name, college_email)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1)), NEW.email);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.item_kind NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  category text NOT NULL CHECK (category IN ('Keys','Bottles','Phones','Bags','Cards','Books','Clothing','Other')),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  photo_url text,
  location text NOT NULL CHECK (char_length(location) BETWEEN 2 AND 160),
  occurred_at timestamptz,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reporter_name text,
  reporter_role public.campus_role,
  status public.item_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_kind_created_idx ON public.items (kind, created_at DESC);
GRANT SELECT ON public.items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can browse items" ON public.items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Signed-in users post own items" ON public.items FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reporter updates own items" ON public.items FOR UPDATE TO authenticated USING (auth.uid() = reporter_id) WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Reporter deletes own items" ON public.items FOR DELETE TO authenticated USING (auth.uid() = reporter_id);

CREATE OR REPLACE FUNCTION public.items_fill_reporter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  NEW.reporter_id := auth.uid();
  SELECT full_name, campus_role INTO p FROM public.profiles WHERE id = NEW.reporter_id;
  NEW.reporter_name := split_part(COALESCE(p.full_name, 'Campus member'), ' ', 1);
  NEW.reporter_role := p.campus_role;
  RETURN NEW;
END; $$;
CREATE TRIGGER items_fill_reporter_trg BEFORE INSERT ON public.items FOR EACH ROW EXECUTE FUNCTION public.items_fill_reporter();

CREATE POLICY "Item photos are viewable" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'item-photos');
CREATE POLICY "Users upload own item photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own item photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = auth.uid()::text);