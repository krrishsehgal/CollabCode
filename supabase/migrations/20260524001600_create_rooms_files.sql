-- Create rooms table
CREATE TABLE public.rooms (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    room_code TEXT UNIQUE,
    created_by UUID,
    created_at TIMESTAMP
    WITH
        TIME ZONE NOT NULL DEFAULT now()
);

-- Create files table
CREATE TABLE public.files (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    room_id UUID REFERENCES public.rooms (id) ON DELETE CASCADE,
    file_name TEXT,
    language TEXT,
    content TEXT,
    updated_at TIMESTAMP
    WITH
        TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Rooms are viewable by authenticated users" ON public.rooms FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Rooms can be inserted by authenticated users" ON public.rooms FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Rooms can be updated by authenticated users" ON public.rooms FOR
UPDATE USING (
    auth.role () = 'authenticated'
)
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Rooms can be deleted by authenticated users" ON public.rooms FOR DELETE USING (
    auth.role () = 'authenticated'
);

CREATE POLICY "Files are viewable by authenticated users" ON public.files FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Files can be inserted by authenticated users" ON public.files FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Files can be updated by authenticated users" ON public.files FOR
UPDATE USING (
    auth.role () = 'authenticated'
)
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Files can be deleted by authenticated users" ON public.files FOR DELETE USING (
    auth.role () = 'authenticated'
);

-- Updated_at trigger
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();