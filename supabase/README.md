# Preparação do banco Supabase

O esquema fica versionado em `migrations/20261113000000_nexus_cloud.sql`.

## Aplicar a migração

Instale o Supabase CLI, autentique e vincule a pasta ao projeto Supabase:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push --remote
```

O `db push` aplica as migrações ainda não executadas e registra o histórico no projeto remoto. Mantenha alterações futuras do esquema em novos arquivos de migração; evite editar o banco remoto fora desse fluxo.

## Liberar membros

O NEXUS não oferece cadastro público. Crie a primeira conta em **Authentication → Users**, copie o UUID e execute:

```sql
insert into public.nexus_members (user_id, role)
values ('UUID-DO-USUARIO', 'admin');
```

Para cada membro adicional, crie uma conta no painel e insira o UUID com `role = 'member'`. As contas aprovadas compartilham o mesmo espaço de trabalho. O papel `admin` fica registrado para administração futura; nesta versão, todo membro aprovado pode gerenciar os registros.

As tabelas têm Row Level Security habilitado. Visitantes sem sessão e usuários que não constam em `nexus_members` não conseguem ler ou alterar registros.
