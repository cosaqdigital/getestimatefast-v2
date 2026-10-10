# Backend isolado e Preview — continuação da PR #50

Atualização posterior à #51: o projeto `getestimatefast-development` / `cpjsbijgijeyrwjpuciv` foi criado pelo usuário e reconhecido pelo conector. A auditoria e a ordem completa proposta estão em [verificação e plano antes da instalação](development-project-verification-and-migration-plan.md). A seção abaixo registra o bloqueio histórico da etapa anterior; nenhuma migração remota foi aplicada na atualização.

## Situação e bloqueios

Em 9 de outubro de 2026, a conexão Supabase lista somente `getestimatefast-prod`, `orcamentos-brasil` e `pelos-e-patas-brasil`. Nenhum é seguro para esta etapa. Não foram criados projetos nem branches Supabase. A criação exige seleção da organização e confirmação do custo; essas dependências ficam registradas para uma etapa de provisionamento autorizada, conforme solicitado. Não usar uma branch de produção nem copiar tabelas, usuários, credenciais ou dados reais.

A conexão Vercel retorna 404 para `getestimatefast-v2` no time conhecido e não lista projetos correspondentes. Nenhuma variável remota foi criada, lida com valor secreto, substituída ou apagada. Production permanece intacto. A integração GitHub pode publicar automaticamente um deploy de Preview; isso não provisiona o banco nem comprova que as funcionalidades estão disponíveis.

O código desta branch rejeita credenciais herdadas de produção no Preview quando o modo isolado está ausente. Com o modo isolado, rejeita todos os refs conhecidos das plataformas existentes. O formulário público de leads/email também fica bloqueado no ambiente isolado, inclusive se houver uma chave Resend herdada. As travas SMS existentes continuam vigentes.

## Provisionamento posterior

1. Confirmar organização proprietária, custo/plano e região americana antes de criar um projeto exclusivo, por exemplo `getestimatefast-development`. Não criar recursos automaticamente a partir deste documento.
2. Criar um projeto vazio, com credenciais e Auth próprios. Não importar registros reais. Ativar somente provedores Auth necessários para contas fictícias; preparar confirmação de e-mail sem enviar mensagens a terceiros. Contas administrativas devem usar MFA no ambiente hospedado.
3. Instalar o schema base correspondente à PR #49, revisado sem seeds ou IDs reais. A sequência mínima utilizada nos testes está no sandbox: leads, marketplace, contractors, consent, auto-enable, publication, matching rounds, SMS simulation e webhook safety. Conferir também RPCs administrativos existentes caso sejam testados os painéis anteriores.
4. Aplicar os seis scripts da PR #50 na ordem auditada abaixo e depois `sql/us_stripe_test_checkout.sql`. Gerar/registrar a migração final no fluxo CLI Supabase apenas depois da revisão. Nunca apontar CLI/MCP para `getestimatefast-prod`.
5. Executar advisors de segurança e desempenho no novo projeto. Conferir RLS, grants de service_role, ausência de políticas públicas nas tabelas financeiras e grants revogados das RPCs. O schema `gef_private` deve permanecer fora dos schemas expostos do PostgREST.
6. Criar contas e leads exclusivamente fictícios. Desabilitar entregas externas de Auth/email/SMS nos testes automáticos. Ajustar URL de Auth e redirects para a origem Preview confiável; não incluir domínios ou callbacks de produção.
7. Restabelecer acesso Vercel ao projeto/time corretos. Usar variáveis de **Preview**, com `gitBranch=feat/isolated-preview-stripe-test-20261009`, sem alvo Production e sem substituir o Preview de outras branches. Guardar secrets como Secret, configurar valores no painel autorizado e verificar apenas nomes, tipo e escopo.
8. Usar os nomes de `.env.preview.example`. Não colar secrets em chats, PRs, terminal, argumentos de comando ou logs. Manter `GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED=false`; os secrets Stripe podem permanecer ausentes nesta fase.
9. Rodar `node scripts/preview-readiness.js` no runtime de Preview. O relatório contém somente nomes ausentes e erros de configuração. Redeploy apenas da branch e testar Auth, RLS e Storage reais antes de declarar o ambiente pronto.

## Auditoria dos seis scripts

| Script | Dependências | Resultado da auditoria/teste local |
|---|---|---|
| `us_marketplace_financial_foundation.sql` | roles anon/authenticated/service_role, auth.users, admin_users, contractor_profiles, leads, opportunity_previews | Ledger imutável, locks, centavos bigint, grants restritos. Compras simultâneas, ajustes e estornos exercitados em PostgreSQL 17 nativo. Fonte financeira adicional distingue pagamento direto da carteira. |
| `us_public_profiles_reviews.sql` | foundation financeira, contas e perfis base | Perfil público por consentimento; convites únicos; avaliações moderadas e origem preservada. HMAC/validação também passam pelos handlers. |
| `us_marketplace_read_models.sql` | perfis/reviews e finanças | Projeções explícitas; administração autenticada; configuração auditada; advisory lock para idempotência. Previews comerciais passam a contar reservas Checkout após o script adicional. |
| `us_topup_test_contract.sql` | payment_intents, ledger, promoções | Exclusivamente synthetic/test-mode. Nenhuma rota de recarga nova chama esta função. Mantido para regressão da PR #50. |
| `us_public_review_rate_limit.sql` | schema privado e roles | Contador persistente por hash/hora, sem armazenar endereço bruto; limites e permissões testados. Limpeza periódica dos contadores antigos deve ser definida no ambiente hospedado. |
| `us_portfolio_storage.sql` | serviço Storage e storage.buckets | DDL do bucket compilou contra stub local com limite/tipos corretos. Upload mediado testado localmente; Storage real e políticas efetivas ainda exigem Supabase. Bucket público é exclusivamente para fotos cuja publicação foi consentida. |

Scripts de criação de tabelas da PR #50 são de instalação única e não devem ser reaplicados a um schema parcialmente migrado. Cada script com transação faz rollback no erro. O bucket usa conflito sem alteração: se já existir, verificar que public/limites/MIME correspondem ao contrato, em vez de presumir que o script corrigiu a configuração.

O script adicional de Stripe inclui o campo de origem para bancos isolados já instalados com #50, protege o antigo estorno contra conversão de pagamentos diretos em créditos e adiciona tabelas/RPCs de pedidos e eventos. Não aplicar esse script em produção. Uma instalação existente deve ter backup **somente sintético**, comparar seu schema com #50 e registrar a atualização no histórico de migrações.

## Execução local reproduzível

`npm ci --ignore-scripts` e `npm test`. Os testes usam PostgreSQL 17.10 nativo, com múltiplas conexões e locks observados em `pg_stat_activity`, e PostgreSQL PGlite para regressão. O pacote de PostgreSQL contém binários locais; não instala serviço nem cria usuário do sistema. Em plataformas que precisem de symlinks, revisar e executar somente o script de hidratação do pacote da plataforma. Não habilitar scripts de instalação indiscriminadamente.

O cluster usa endereço `127.0.0.1`, porta livre e senha aleatória efêmera, guarda arquivos em `test-output/` ignorado pelo Git e é encerrado ao fim dos testes. Não aceita URL remota. O sandbox de interface usa `node scripts/local-marketplace-sandbox.js 4173`; credenciais fictícias e rotas estão no relatório da #50. Auth e Storage são simulados nesse sandbox, sem alegação de equivalência completa ao Supabase hospedado.

Referências: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vercel escopo de variáveis](https://vercel.com/docs/environment-variables), [PostgreSQL locks](https://www.postgresql.org/docs/17/explicit-locking.html).
