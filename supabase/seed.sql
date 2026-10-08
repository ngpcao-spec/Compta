-- Utilisateur de test local (e2e) : test@sothuchi.local / test-password-123
-- Le trigger on_auth_user_created crée profil + 40 catégories.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'test@sothuchi.local',
  extensions.crypt('test-password-123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Người Dùng Thử"}', now(), now(),
  '', '', '', ''
) on conflict (id) do nothing;
