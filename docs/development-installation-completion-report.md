# Supabase Development — instalação concluída
Projeto exclusivo: **getestimatefast-development / cpjsbijgijeyrwjpuciv**.
Data UTC: 2026-10-10.
PR de origem: [draft #52](https://github.com/cosaqdigital/getestimatefast-v2/pull/52).
Commit SQL revisado: `8b0a33726e05cab503b636af23a54cfdb47a0da4`.

**17 scripts aplicados nesta retomada; 20 migrações no total, únicas, em ordem.**
Os scripts 1–3 não foram reaplicados, renomeados ou reparados. Nenhum script SQL aprovado foi modificado.

## Controle de versões
A [API oficial apply migration](https://supabase.com/docs/reference/api/v1-apply-a-migration), utilizada pelo conector, gera versões automaticamente e não aceita versão explícita. Não alteramos o gerador do serviço nem inserimos timestamps manualmente no histórico.

O controle desta execução:
1. Lê o histórico e exige nomes, quantidade e ordem exatos para a etapa.
2. Confere o segundo UTC do banco e do relógio da ferramenta. Ambos precisam ser maiores que a última versão e não aparecer no histórico. Se o segundo ainda estiver ocupado, aguarda e repete toda a consulta; não depende somente de um intervalo fixo.
3. Aplica um único script pelo mecanismo suportado apply_migration.
4. Lê novamente o histórico e exige uma nova versão única, maior que a anterior, com o nome correto, sem mudar nenhuma migração prévia.
5. Confere tabelas/funções esperadas, RLS, grants de navegador, search_path, privilégios, índices/constraints válidos, trigger ensure_rls, tabelas vazias e ausência de dados Auth/Storage. Qualquer divergência encerra a execução.

Essas checagens previnem a repetição de versões deste fluxo sequencial. Não são uma reserva atômica de versão contra outro operador concorrente: a API não expõe esse recurso. A chave única do histórico continua sendo a proteção final; qualquer erro de SQL/colisão teria interrompido a execução. **Nenhuma colisão ocorreu nesta retomada.**

## Histórico final
| Ordem | Script | Versão registrada | Situação |
|---:|---|---|---|
| 1 | development_baseline_permissions.sql | 20261010023945 | Preservado da etapa anterior |
| 2 | getestimatefast_leads.sql | 20261010023958 | Preservado da etapa anterior |
| 3 | getestimatefast_marketplace_foundation.sql | 20261010023959 | Preservado da etapa anterior |
| 4 | getestimatefast_admin_status_rpc.sql | 20261010025324 | Aplicado e conferido nesta retomada |
| 5 | admin_approve_lead.sql | 20261010025331 | Aplicado e conferido nesta retomada |
| 6 | getestimatefast_contractors_foundation.sql | 20261010025339 | Aplicado e conferido nesta retomada |
| 7 | contractor_consent_fields.sql | 20261010025347 | Aplicado e conferido nesta retomada |
| 8 | contractor_auto_enable.sql | 20261010025356 | Aplicado e conferido nesta retomada |
| 9 | opportunity_publication_preview.sql | 20261010025403 | Aplicado e conferido nesta retomada |
| 10 | admin_reconfirm_legacy_review.sql | 20261010025411 | Aplicado e conferido nesta retomada |
| 11 | controlled_matching_rounds.sql | 20261010025418 | Aplicado e conferido nesta retomada |
| 12 | sms_simulation_preview.sql | 20261010025426 | Aplicado e conferido nesta retomada |
| 13 | zenvia_us_webhook_safety.sql | 20261010025432 | Aplicado e conferido nesta retomada |
| 14 | us_marketplace_financial_foundation.sql | 20261010025439 | Aplicado e conferido nesta retomada |
| 15 | us_public_profiles_reviews.sql | 20261010025446 | Aplicado e conferido nesta retomada |
| 16 | us_marketplace_read_models.sql | 20261010025453 | Aplicado e conferido nesta retomada |
| 17 | us_topup_test_contract.sql | 20261010025500 | Aplicado e conferido nesta retomada |
| 18 | us_public_review_rate_limit.sql | 20261010025507 | Aplicado e conferido nesta retomada |
| 19 | us_portfolio_storage.sql | 20261010025645 | Aplicado e conferido nesta retomada |
| 20 | us_stripe_test_checkout.sql | 20261010025652 | Aplicado e conferido nesta retomada |

Os hashes SHA-256 de origem, versões pré/pós-checagem e os resultados dos Advisors estão em `docs/development-installation-resume-log.json`. Os hashes foram reconferidos contra o relatório anterior e o conteúdo do commit aprovado, considerando a diferença CRLF/LF do checkout Windows.

## Estado final verificado
- **28 tabelas**, todas vazias, todas com RLS, em public e gef_private.
- **39 funções**, incluindo a função gerenciada rls_auto_enable; nenhuma executável por anon/authenticated.
- Todas as RPCs gef_* possuem EXECUTE para service_role, usam SECURITY INVOKER e search_path fixo. Funções trigger não exigem grants de chamada RPC.
- **92 índices válidos**, incluindo todos os 36 índices explicitamente criados pelos scripts e índices implícitos de PK/UNIQUE.
- **13 triggers de aplicação ativos**, incluindo imutabilidade do ledger/históricos, serialização de saldo, limites de compradores e proteção contra estorno direto em carteira.
- Nenhuma constraint não validada. Todos os campos monetários terminados em _cents são bigint; eventos de pagamentos impõem USD e modo test.
- Nenhum grant SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN de tabelas de aplicação para anon/authenticated. gef_private nega USAGE para ambos e concede USAGE para service_role.
- rls_auto_enable continua SECURITY DEFINER, com search_path=pg_catalog e sem EXECUTE de navegador; ensure_rls continua ativo.
- Bucket **gef-portfolio** criado, public=true, máximo **3.000.000 bytes**, MIME JPEG/PNG/WebP. É público para imagens consentidas conforme o script aprovado; não serve para documentos privados. Storage.objects conserva RLS, sem policies de INSERT/UPDATE/DELETE para navegadores.
- **Zero usuários Auth e zero objetos Storage.** Nenhuma fixture persistente ou operação financeira foi criada remotamente.
- Consultas de leitura com identificador fictício confirmaram saldo zero e perfil inexistente não divulgado. Essas leituras não criaram carteira/usuário.
- Nenhuma configuração Vercel/Stripe foi alterada. Stripe Checkout permanece sem ativação; nenhuma chamada a Stripe ou entrega SMS foi realizada.

## Testes
**npm test: 61 aprovados, 0 falhas (28,8 segundos)** nesta retomada.
Cobertura local: instalação dos 20 scripts, sessões concorrentes, idempotência, saldo negativo, limite de compradores, estornos, separação de criação de perfil e carteira, avaliações/moderação, privacidade, HTTP/DOM, gating de pagamento e transporte Stripe sintético.
Os testes usam bancos locais, dados fictícios e mocks de serviços externos. Não equivalem a validação funcional de Preview com usuários remotos: o banco remoto permanece vazio. O Storage foi validado por configuração/permissões; upload/download funcional com autenticação real de teste fica para a próxima etapa.

## Avisos dos Supabase Advisors
**Segurança: 0 ERROR / 0 WARN.** Há 28 INFO de [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), esperados no desenho atual de acesso via backend/service_role, com grants diretos de navegador revogados. Não adicionamos policies públicas para eliminar esses INFO.

**Desempenho: 40 INFO, 0 WARN/ERROR**:
- 6 [FKs sem índice de cobertura](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys):
  - gef_private.contact_quotes: FK composta terms_id/opportunity_id/rule_id/max_buyers/opportunity_expires_at/published_at_snapshot; já há índice isolado terms_id, mas o advisor pede cobertura da composição.
  - public.contractor_verification_events: contractor_id e actor_admin_id.
  - public.lead_status_events: actor_user_id.
  - public.opportunity_matching_rounds: selected_by.
  - public.opportunity_previews: published_by.
- 33 [índices ainda não utilizados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), esperados no banco vazio. Nenhum removido.
- 1 [Auth com máximo absoluto de 10 conexões](https://supabase.com/docs/guides/deployment/going-into-prod), a reavaliar ao dimensionar a instância.

## Ocorrências
Sem erro de SQL, colisão de versão, inconsistência de schema ou problema de segurança nesta retomada.
Houve uma resposta **429 RATE_LIMITED** na consulta de pré-checagem anterior ao script 19. Nenhuma migração estava em trânsito nessa chamada. Aguardamos 60 segundos conforme retry_after, reconfirmamos o histórico até o script 18 e concluímos os scripts 19–20. Nada foi reaplicado.
As mensagens/versões da falha da etapa anterior continuam no relatório histórico `docs/development-installation-execution-report.md`.

## Próximos passos
1. Preparar índices adicionais para os seis INFO de FK como nova alteração revisável, sem modificar migrações já registradas.
2. Preparar usuários/fixtures explicitamente fictícios por Auth seguro e testar Preview → Auth → API → SQL → Storage sem SMS/e-mails externos.
3. Configurar apenas Preview para este backend em etapa própria, preservando Production e Stripe desativado.
4. Validação funcional completa de dashboard, oportunidades, carteira simulada, perfis/portfólio, avaliações e administração permanece separada da instalação concluída.

Nenhuma alteração em getestimatefast-prod, Orçamentos Brasil, main ou Vercel Production; nenhum merge, cobrança ou SMS.
