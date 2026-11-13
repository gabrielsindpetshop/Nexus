# NEXUS · SindPetshop-SP

Aplicação web para organizar oportunidades, ideias, avaliações, projetos, pesquisas e referências institucionais. O frontend usa React/Vite; autenticação e dados compartilhados usam Supabase; a publicação está preparada para Vercel.

## Desenvolvimento local

1. Instale Node.js 20+ e o Supabase CLI.
2. Copie `.env.example` para `.env.local`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores do seu projeto Supabase.
4. Instale e execute o app:

```bash
npm install
npm run dev
```

## Banco Supabase

O esquema e as políticas de segurança estão em `supabase/migrations`. Para aplicar a migração ao seu projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push --remote
```

Depois, crie contas em **Authentication → Users** e cadastre os UUIDs autorizados em `public.nexus_members`. O NEXUS não oferece cadastro público. Todos os membros autorizados compartilham o mesmo espaço.

A tabela de registros usa RLS, e somente usuários autorizados podem acessar o banco. O app usa apenas a chave **publishable** do Supabase. Nunca coloque uma chave `sb_secret_...` ou `service_role` em `VITE_*`, no Git ou no navegador.

## Publicação na Vercel

1. Envie este repositório a GitHub, GitLab ou Bitbucket e importe-o na Vercel.
2. O `vercel.json` configura a compilação Vite e a pasta `dist`.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente **Development**, **Preview** e **Production** da Vercel.
4. Após o primeiro deploy, adicione o domínio da Vercel em **Supabase → Authentication → URL Configuration → Redirect URLs** e defina o Site URL.
5. Os pushes na branch de produção podem gerar deploys automáticos quando o repositório estiver conectado à Vercel.

Variáveis `VITE_*` são incorporadas no frontend durante o build; use nelas somente valores destinados ao cliente. RLS e autenticação protegem o acesso aos dados.

## Backups e migração local

- **Configurações → Exportar backup JSON** salva uma cópia dos registros na nuvem.
- A importação JSON valida os dados e pede confirmação antes de mesclar ou substituir o espaço compartilhado.
- Cada módulo pode ser exportado em CSV.
- **Importar dados deste navegador** recupera os registros da versão anterior em IndexedDB, sem apagar os dados locais.
- Mantenha backups periódicos mesmo com a persistência remota.

## Compilação local

```bash
npm run build
npm run preview
```
