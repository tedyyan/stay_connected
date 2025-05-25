-- Create junction table for events and contacts
create table public.event_contacts (
  id uuid not null default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events(id),
  contact_id uuid not null references public.contacts(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (id),
  unique(event_id, contact_id)
);

-- Add indexes for better query performance
create index idx_event_contacts_event_id on public.event_contacts(event_id);
create index idx_event_contacts_contact_id on public.event_contacts(contact_id);

-- Add RLS policies
alter table public.event_contacts enable row level security;

create policy "Users can view their own event contacts"
  on public.event_contacts for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
      and e.user_id = auth.uid()
    )
  );

create policy "Users can insert their own event contacts"
  on public.event_contacts for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id
      and e.user_id = auth.uid()
    )
  );

create policy "Users can update their own event contacts"
  on public.event_contacts for update
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
      and e.user_id = auth.uid()
    )
  );

create policy "Users can delete their own event contacts"
  on public.event_contacts for delete
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
      and e.user_id = auth.uid()
    )
  ); 