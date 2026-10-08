-- Sổ Thu Chi — schéma initial (SPEC §6)
create type public.tx_type as enum ('expense', 'income');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  hide_amounts boolean not null default false,
  default_budget bigint check (default_budget is null or default_budget > 0),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  type public.tx_type not null,
  name text not null check (char_length(name) between 1 and 30),
  icon text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid not null references public.categories on delete restrict,
  type public.tx_type not null,
  amount bigint not null check (amount > 0 and amount < 10000000000000),
  note text check (note is null or char_length(note) <= 100),
  occurred_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount bigint not null check (amount > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index on public.transactions (user_id, occurred_on);
create index on public.transactions (user_id, server_updated_at);
create index on public.transactions (category_id);
create index on public.categories (user_id, server_updated_at);
create index on public.budgets (user_id, server_updated_at);

-- Curseur de synchronisation ---------------------------------------------
create function public.set_server_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger z_server_updated_at before insert or update on public.profiles
  for each row execute function public.set_server_updated_at();
create trigger z_server_updated_at before insert or update on public.categories
  for each row execute function public.set_server_updated_at();
create trigger z_server_updated_at before insert or update on public.transactions
  for each row execute function public.set_server_updated_at();
create trigger z_server_updated_at before insert or update on public.budgets
  for each row execute function public.set_server_updated_at();

-- Dernier écrit gagne (horodatage client) --------------------------------
create function public.keep_newest() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end;
$$;

create trigger a_lww before update on public.profiles
  for each row execute function public.keep_newest();
create trigger a_lww before update on public.categories
  for each row execute function public.keep_newest();
create trigger a_lww before update on public.transactions
  for each row execute function public.keep_newest();
create trigger a_lww before update on public.budgets
  for each row execute function public.keep_newest();

-- Cohérence transaction / catégorie --------------------------------------
create function public.check_transaction_category() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat public.categories%rowtype;
begin
  select * into cat from public.categories where id = new.category_id;
  if not found then
    raise exception 'category % not found', new.category_id using errcode = '23503';
  end if;
  if cat.user_id <> new.user_id then
    raise exception 'category belongs to another user' using errcode = '42501';
  end if;
  if cat.type <> new.type then
    raise exception 'transaction type must match category type' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger b_check_category before insert or update on public.transactions
  for each row execute function public.check_transaction_category();

-- RLS ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy categories_select on public.categories for select to authenticated
  using (user_id = (select auth.uid()));
create policy categories_insert on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy categories_update on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy transactions_select on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy budgets_select on public.budgets for select to authenticated
  using (user_id = (select auth.uid()));
create policy budgets_insert on public.budgets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy budgets_update on public.budgets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Aucun DELETE depuis le client, aucun accès anonyme.
revoke all on public.profiles, public.categories, public.transactions, public.budgets from anon, authenticated;
grant select, insert, update on public.profiles, public.categories, public.transactions, public.budgets to authenticated;

-- Inscription (SPEC §6.3) -------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );

  insert into public.categories (id, user_id, type, name, icon, color, sort_order)
  select
    gen_random_uuid(),
    new.id,
    d.type::public.tx_type,
    d.name,
    d.icon,
    d.color,
    row_number() over (partition by d.type order by d.ord) - 1
  from (
    select row_number() over () as ord, t.*
    from (values
      ('expense', 'Ăn uống', 'utensils', '#FBC02D'),
      ('expense', 'Quần áo', 'shirt', '#26C6DA'),
      ('expense', 'Thú cưng', 'cat', '#7986CB'),
      ('expense', 'Mua sắm', 'shopping-cart', '#2196F3'),
      ('expense', 'Cà phê', 'coffee', '#FF8A65'),
      ('expense', 'Du lịch', 'plane', '#7E57C2'),
      ('expense', 'Thể thao', 'dumbbell', '#C0CA33'),
      ('expense', 'Trái cây', 'apple', '#66BB6A'),
      ('expense', 'Quà tặng', 'gift', '#EC407A'),
      ('expense', 'Game', 'gamepad-2', '#FF7043'),
      ('expense', 'Đi lại', 'bus', '#42A5F5'),
      ('expense', 'Xăng xe', 'fuel', '#8D6E63'),
      ('expense', 'Tiền nhà', 'home', '#5C6BC0'),
      ('expense', 'Điện', 'zap', '#FFCA28'),
      ('expense', 'Nước', 'droplet', '#29B6F6'),
      ('expense', 'Internet', 'wifi', '#26A69A'),
      ('expense', 'Điện thoại', 'smartphone', '#78909C'),
      ('expense', 'Y tế', 'stethoscope', '#EF5350'),
      ('expense', 'Thuốc', 'pill', '#E57373'),
      ('expense', 'Giáo dục', 'graduation-cap', '#3F51B5'),
      ('expense', 'Sách', 'book-open', '#8D6E63'),
      ('expense', 'Làm đẹp', 'sparkles', '#F06292'),
      ('expense', 'Giải trí', 'party-popper', '#AB47BC'),
      ('expense', 'Phim ảnh', 'clapperboard', '#5E35B1'),
      ('expense', 'Con cái', 'baby', '#FFB74D'),
      ('expense', 'Gia đình', 'users', '#4DB6AC'),
      ('expense', 'Bảo hiểm', 'shield', '#546E7A'),
      ('expense', 'Sửa chữa', 'wrench', '#90A4AE'),
      ('expense', 'Đồ gia dụng', 'sofa', '#A1887F'),
      ('expense', 'Rau củ', 'carrot', '#9CCC65'),
      ('expense', 'Đồ uống', 'cup-soda', '#4FC3F7'),
      ('expense', 'Hiếu hỉ', 'heart', '#E91E63'),
      ('expense', 'Từ thiện', 'hand-heart', '#BA68C8'),
      ('expense', 'Thuế', 'receipt', '#757575'),
      ('expense', 'Khác', 'ellipsis', '#9E9E9E'),
      ('income', 'Lương', 'circle-dollar-sign', '#AB47BC'),
      ('income', 'Thưởng', 'award', '#FFA726'),
      ('income', 'Đầu tư', 'trending-up', '#26A69A'),
      ('income', 'Làm thêm', 'briefcase', '#42A5F5'),
      ('income', 'Thu nhập khác', 'plus-circle', '#9E9E9E')
    ) as t(type, name, icon, color)
  ) d;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_server_updated_at() from public, anon, authenticated;
revoke execute on function public.keep_newest() from public, anon, authenticated;
revoke execute on function public.check_transaction_category() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
