begin;

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  source_key text unique,
  name text not null,
  email text unique,
  team_code text unique,
  role text not null default 'team_member'
    check (role in ('team_member', 'manager', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'onboarding')),
  manager_label text,
  manager_employee_id uuid references public.employees(id) on delete set null,
  gotyme_account_number text,
  salary_usd numeric(12,2) default 0,
  tools_usd numeric(12,2) default 0,
  allowances_usd numeric(12,2) default 0,
  total_budget_usd numeric(12,2) default 0,
  coach_email text,
  imported_from text default 'google_sheet',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  client_name text not null,
  email text,
  phone text,
  address text,
  company text,
  status text not null default 'active',
  imported_from text default 'google_sheet',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  client_id uuid references public.clients(id) on delete set null,
  project_name text not null unique,
  project_details text,
  quantity numeric(12,2),
  pay_scheme text,
  charges_per_month_usd numeric(12,2),
  status text not null default 'active',
  imported_from text default 'google_sheet',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_rates (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  activity text not null unique,
  rate_usd numeric(12,2) default 0,
  status text not null default 'active',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  log_code text unique,
  work_date date not null,
  employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  employee_label text,
  project_label text,
  activity text,
  time_in time,
  time_out time,
  total_hours numeric(8,2) default 0,
  notes text,
  status text not null default 'closed',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  request_code text unique,
  requested_at date,
  employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  employee_label text,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  total_days integer default 0,
  client_project_label text,
  proof_url text,
  reason text,
  rule_validation text,
  manager_status text not null default 'pending',
  notify_client boolean default false,
  auto_log_time boolean default false,
  reviewed_by uuid references public.employees(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  client_invoice_date date not null unique,
  pay_date date,
  coverage_start date,
  coverage_end date,
  coverage_label text,
  total_invoice_usd numeric(12,2) default 0,
  total_pay_php numeric(14,2) default 0,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  employee_id uuid references public.employees(id) on delete set null,
  employee_label text,
  pay_period_start date,
  pay_period_end date,
  total_hours numeric(8,2) default 0,
  hourly_rate_usd numeric(12,2) default 0,
  gross_usd_pay numeric(12,2) default 0,
  exchange_rate numeric(12,6),
  allowances_php numeric(14,2) default 0,
  deductions_php numeric(14,2) default 0,
  total_pay_php numeric(14,2) default 0,
  generation_type text,
  pdf_url text,
  pdf_status text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  invoice_code text unique,
  project_id uuid references public.projects(id) on delete set null,
  project_label text,
  period_start date,
  period_end date,
  line_items_raw text,
  line_items jsonb not null default '[]'::jsonb,
  total_subtotal_usd numeric(12,2) default 0,
  wise_payment_request_link text,
  pdf_url text,
  pdf_status text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  session_date date,
  employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  team_member_label text,
  client_label text,
  coaching_type text,
  schedule_link text,
  incident_details text,
  transcript_links text,
  commitment_goals text,
  coach_signature text,
  member_signature text,
  status text default 'pending',
  follow_up_date date,
  reviewer text,
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'google_sheet',
  spreadsheet_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.source_row_mappings (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.import_batches(id) on delete cascade,
  source_sheet text not null,
  source_row integer,
  source_key text not null,
  target_table text not null,
  target_id uuid,
  imported_at timestamptz not null default now(),
  unique (source_key, target_table)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_employee_id uuid references public.employees(id) on delete set null,
  event_type text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employees_role_idx on public.employees(role);
create index if not exists employees_auth_user_id_idx on public.employees(auth_user_id);
create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists time_logs_employee_date_idx on public.time_logs(employee_id, work_date desc);
create index if not exists time_logs_project_date_idx on public.time_logs(project_id, work_date desc);
create index if not exists leave_requests_status_idx on public.leave_requests(manager_status);
create index if not exists payslips_employee_period_idx on public.payslips(employee_id, pay_period_end desc);
create index if not exists invoices_period_idx on public.invoices(period_end desc);
create index if not exists coaching_sessions_employee_date_idx on public.coaching_sessions(employee_id, session_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists activity_rates_set_updated_at on public.activity_rates;
create trigger activity_rates_set_updated_at before update on public.activity_rates
for each row execute function public.set_updated_at();

drop trigger if exists time_logs_set_updated_at on public.time_logs;
create trigger time_logs_set_updated_at before update on public.time_logs
for each row execute function public.set_updated_at();

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at before update on public.leave_requests
for each row execute function public.set_updated_at();

drop trigger if exists pay_periods_set_updated_at on public.pay_periods;
create trigger pay_periods_set_updated_at before update on public.pay_periods
for each row execute function public.set_updated_at();

drop trigger if exists payslips_set_updated_at on public.payslips;
create trigger payslips_set_updated_at before update on public.payslips
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists coaching_sessions_set_updated_at on public.coaching_sessions;
create trigger coaching_sessions_set_updated_at before update on public.coaching_sessions
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = auth.uid()
     or lower(e.email) = lower(auth.email())
  limit 1;
$$;

create or replace function public.current_employee_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select e.role
    from public.employees e
    where e.auth_user_id = auth.uid()
       or lower(e.email) = lower(auth.email())
    limit 1
  ), 'anonymous');
$$;

create or replace function public.current_employee_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_employee_role() in ('manager', 'admin');
$$;

alter table public.employees enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.activity_rates enable row level security;
alter table public.time_logs enable row level security;
alter table public.leave_requests enable row level security;
alter table public.pay_periods enable row level security;
alter table public.payslips enable row level security;
alter table public.invoices enable row level security;
alter table public.coaching_sessions enable row level security;
alter table public.app_settings enable row level security;
alter table public.import_batches enable row level security;
alter table public.source_row_mappings enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists employees_manager_all on public.employees;
create policy employees_manager_all on public.employees
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists employees_self_select on public.employees;
create policy employees_self_select on public.employees
for select using (id = public.current_employee_id());

drop policy if exists clients_manager_all on public.clients;
create policy clients_manager_all on public.clients
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists projects_manager_all on public.projects;
create policy projects_manager_all on public.projects
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists activity_rates_manager_all on public.activity_rates;
create policy activity_rates_manager_all on public.activity_rates
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists time_logs_manager_all on public.time_logs;
create policy time_logs_manager_all on public.time_logs
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists time_logs_self_select on public.time_logs;
create policy time_logs_self_select on public.time_logs
for select using (employee_id = public.current_employee_id());

drop policy if exists leave_requests_manager_all on public.leave_requests;
create policy leave_requests_manager_all on public.leave_requests
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists leave_requests_self_select on public.leave_requests;
create policy leave_requests_self_select on public.leave_requests
for select using (employee_id = public.current_employee_id());

drop policy if exists payslips_manager_all on public.payslips;
create policy payslips_manager_all on public.payslips
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists payslips_self_select on public.payslips;
create policy payslips_self_select on public.payslips
for select using (employee_id = public.current_employee_id());

drop policy if exists invoices_manager_all on public.invoices;
create policy invoices_manager_all on public.invoices
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists pay_periods_manager_all on public.pay_periods;
create policy pay_periods_manager_all on public.pay_periods
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists coaching_sessions_manager_all on public.coaching_sessions;
create policy coaching_sessions_manager_all on public.coaching_sessions
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists coaching_sessions_self_select on public.coaching_sessions;
create policy coaching_sessions_self_select on public.coaching_sessions
for select using (employee_id = public.current_employee_id());

drop policy if exists app_settings_manager_all on public.app_settings;
create policy app_settings_manager_all on public.app_settings
for all using (public.current_employee_is_manager())
with check (public.current_employee_is_manager());

drop policy if exists import_batches_manager_select on public.import_batches;
create policy import_batches_manager_select on public.import_batches
for select using (public.current_employee_is_manager());

drop policy if exists source_row_mappings_manager_select on public.source_row_mappings;
create policy source_row_mappings_manager_select on public.source_row_mappings
for select using (public.current_employee_is_manager());

drop policy if exists audit_events_manager_select on public.audit_events;
create policy audit_events_manager_select on public.audit_events
for select using (public.current_employee_is_manager());

commit;
