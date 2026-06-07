-- Create messages table
CREATE TABLE public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    room_id UUID REFERENCES public.rooms (id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Messages are viewable by authenticated users" ON public.messages FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Messages can be inserted by authenticated users" ON public.messages FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );
