# Validação Auth e navegador do Preview — continuação da PR #53

Data: 10/10/2026, America/New_York. Este relatório atualiza os bloqueios anteriores de Auth e acesso visual.

## Ambiente efetivamente testado

- Supabase: getestimatefast-development, `cpjsbijgijeyrwjpuciv`, ACTIVE_HEALTHY, us-east-1.
- Vercel: getestimatefast-v2, `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF`.
- Branch hospedada: `feat/hosted-preview-validation-20261010`.
- Deployment: `dpl_GUr8EjLs2LkVLWttF3ciUD54VXPh`.
- SHA hospedado: `234f5f455f46b0b753963a70284bcea6ea31518f`.
- Preview exato: https://getestimatefast-v2-n6avtilj4-get-estimate-fast.vercel.app
- PR base: https://github.com/cosaqdigital/getestimatefast-v2/pull/53

A correção do plano de fixtures e este relatório estão em uma branch separada, baseada na PR #53. Os testes remotos acima não foram executados em um deployment dessa nova branch.

## Auth administrativo e preparação

O login da CLI foi verificado separadamente do acesso ao Auth Admin. A consulta de chaves foi restrita ao ref Development, usando o comando oficial projects api-keys. A resposta foi capturada em memória, sem imprimir valores, passá-los em argumentos ou gravá-los em arquivos. A chave moderna sb_secret_ foi usada somente pelo executor local para o projeto exato. Uma chamada administrativa de listagem de usuários retornou sucesso e zero usuários antes da criação.

Foram criadas três contas via Auth Admin, com email_confirm=true, sem signup, invite, generateLink, confirmação por e-mail ou escrita direta em auth.users:

| Conta fictícia | Papel da aplicação |
|---|---|
| gef-preview-admin@example.invalid | Administrador de testes |
| gef-preview-contractor@example.invalid | Profissional de Painting |
| gef-preview-other@example.invalid | Profissional de House Cleaning |

O UUID da primeira conta foi inserido em public.admin_users pelo conector SQL exclusivamente Development, conferindo antes e-mail fictício, UUID e confirmação administrativa. O marcador sintético foi usado apenas como verificação de procedência no executor privilegiado, nunca como autorização fornecida por um cliente. As demais contas não receberam privilégios administrativos.

Senhas fortes foram geradas criptograficamente e mantidas em memória. O primeiro executor encerrou após falha nas fixtures; para retomar, foram redefinidas somente as senhas dessas três identidades sintéticas, por Auth Admin, com validação explícita dos UUIDs e marcador de teste. Nenhuma senha, token ou chave foi salva em relatório, log, código ou screenshot. Não há senhas recuperáveis neste relatório; uma execução futura deve redefinir credenciais sintéticas pelo mesmo mecanismo seguro, se necessário.

## Falhas encontradas e correções

1. O primeiro subprocesso de captura de credenciais falhou antes de acessar Auth. A execução foi ajustada para usar o PowerShell disponível no ambiente autenticado e npx.cmd, evitando o wrapper PowerShell incompatível.
2. A primeira inserção de perfil retornou HTTP 400 / SQLSTATE 23514. O banco corretamente rejeitou um perfil ativo sem privacy_accepted_at e terms_accepted_at. A fixture foi completada com timestamps e versões sintéticas de consentimento; o schema e a constraint permaneceram intactos. A inserção rejeitada não deixou perfil parcial.
3. O plano local utilizava Plumbing, ausente do catálogo de lançamento. Foi corrigido para House Cleaning tanto na conta profissional quanto no pedido planejado. Foi documentado o mapeamento obrigatório de confirmação/consentimento antes de ativar um perfil sintético.

Estado final confirmado por SQL: três usuários Auth, um membro admin_users, dois perfis ativos, zero leads e zero objetos Storage. Nenhuma oportunidade, preço ou saldo foi preparado nesta rodada.

## Resultados remotos

| Teste | Resultado |
|---|---|
| Preflight autenticado | HTTP 200, ready=true, marketplace=false, Checkout=false |
| Login administrativo hospedado | HTTP 200 |
| Login dos dois profissionais hospedado | HTTP 200 para ambos |
| Perfil de cada profissional | HTTP 200; somente o próprio user_id |
| Tentativa de escolher outro user_id na query | Ignorada pelo backend; identidade deriva da sessão |
| Oportunidades dos profissionais | HTTP 200, lista vazia, sem dados privados |
| Profissionais acessando /api/admin/leads | HTTP 403 para ambos |
| Leitura direta de contractor_profiles com sessão authenticated | HTTP 403 para ambos |
| Perfil sem autenticação | HTTP 401 |
| Administrador acessando /api/admin/leads | HTTP 200 |
| /api/contractor/marketplace com sessão válida | HTTP 503 esperado, feature desativada |
| Tabelas public sem RLS | Zero |
| Funções gef_* executáveis por anon/authenticated | Zero |

A negação da Data API verifica grants além de RLS. Não representa um teste de políticas de leitura linha a linha: essas tabelas são intencionalmente acessadas pelo backend privado. O controle entre profissionais foi exercitado na API hospedada com sessões distintas.

## Navegador desktop e mobile

O navegador Chromium/Playwright usou OIDC temporário do mesmo projeto, fornecido por vercel env run, com header x-vercel-trusted-oidc-idp-token restrito à origem do Preview. Outras origens foram bloqueadas. SSO e Deployment Protection não foram alterados. Não foram salvos cookies, HAR, traces ou storageState.

Foram executadas seis combinações: administrador e dois profissionais, cada um em 1440 x 900 e 390 x 900. Em todas:

- Login pela interface: HTTP 200 e workspace visível.
- Logout: formulário de login reaparece e workspace fica oculto.
- Campo de senha vazio após o login/logout.
- Zero erros JavaScript pageerror e nenhuma rolagem horizontal.

Telas alcançadas: /admin.html e /contractor-portal.html. Nos profissionais, status active e estado vazio de oportunidades foram aguardados antes da captura. Capturas inspecionadas visualmente incluem o painel administrativo desktop e os dashboards profissionais desktop/mobile. O logout validado é o encerramento local da interface; não foi comprovada revogação imediata de JWT no servidor.

Evidências locais, sem credenciais: `%TEMP%/gef-auth-0-1440.png`, `gef-auth-0-390.png`, `gef-auth-1-1440.png`, `gef-auth-1-390.png`, `gef-auth-2-1440.png`, `gef-auth-2-390.png`.

## Advisors e limites

Validação local após a correção: npm test passou com 65 testes, zero falhas/cancelamentos/skips (123,4 segundos). Inclui concorrência/idempotência em PostgreSQL local, HTTP/DOM e Stripe com transporte sintético; não equivale a aprovação desses fluxos no Preview remoto. O plano de fixtures também passou em uma verificação de pertencimento de todas as categorias ao catálogo e manutenção dos bloqueios de execução remota, pagamentos e entregas. git diff --check passou.

Security Advisors retornou zero ERROR, um WARN e 28 ocorrências INFO:

- WARN: auth_leaked_password_protection — proteção contra senhas vazadas desativada. Não foi alterada a configuração Auth. As senhas sintéticas foram geradas aleatoriamente. A disponibilidade e ativação dessa proteção devem ser avaliadas no Development antes da abertura de cadastro.
- INFO: rls_enabled_no_policy em 28 tabelas, coerente com a arquitetura de acesso privado pelo backend e ausência de grants de navegador. Esses avisos não autorizam abrir policies públicas.

Ainda não aprovados: edição de perfil pelo usuário, publicação de oportunidades, filtros com dados, preços, carteira, perfil público, upload de portfólio, avaliações/moderação e operações financeiras sintéticas. Marketplace permanece desativado; esta rodada não alterou variáveis Vercel nem realizou redeploy. Não confundir o dashboard básico alcançado com aprovação dessas funcionalidades.

Próximos passos: preparar os dois pedidos sintéticos e preços planejados pelo fluxo Development aprovado; conferir novamente isolamento e integridade; somente então considerar a ativação autorizada do marketplace nessa branch e testar os módulos pendentes. A proteção de senhas vazadas é uma pendência de configuração documentada, não uma alteração automática de schema ou Auth nesta etapa.

Stripe Sandbox continua pendente de secrets de teste, assinatura webhook e validação de idempotência/cancelamentos. Checkout não foi ativado e não houve chamadas de cobrança.

## Restrições preservadas

Nenhum acesso ou alteração no Supabase Production, main, Orçamentos Brasil ou Vercel Production. Sem merge, migrações ou alterações de schema. Sem SMS, e-mails ou notificações externas. Cadastro público e entrega externa de leads continuam bloqueados. Marketplace e Checkout continuam false; SMS dry_run.

Referências oficiais: https://supabase.com/docs/reference/javascript/auth-admin-createuser e https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources.
