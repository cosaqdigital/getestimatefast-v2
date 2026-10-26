# Verificação do projeto e plano de instalação — antes de migrações remotas

## Projeto confirmado

O conector Supabase lista e resolve o projeto `getestimatefast-development`, ID/ref **`cpjsbijgijeyrwjpuciv`**, região `us-east-1` (North Virginia), status `ACTIVE_HEALTHY`, PostgreSQL **17.11**. Host confirmado: `db.cpjsbijgijeyrwjpuciv.supabase.co`.

Esse projeto é distinto de `getestimatefast-prod` (`wedsjubkttygxtpkopfj`). Todas as consultas específicas desta etapa usaram somente `cpjsbijgijeyrwjpuciv`. Outros projetos apareceram apenas no inventário do conector. Nenhum registro operacional foi copiado, nenhum segredo foi solicitado/lido e nenhuma credencial foi configurada.

Continuação da PR draft #51, commit base `5d852ffe005f8030c378632ef0cb48c73fb74a84`, em branch própria `feat/development-db-preflight-20261009`. Este relatório é entregue **antes de aplicar qualquer script remotamente**.

## Auditoria somente de leitura

| Verificação | Evidência |
|---|---|
| Tabelas em public/gef_private | Nenhuma |
| Relações de aplicação em outros schemas não gerenciados | Nenhuma |
| Histórico Supabase de migrações | Vazio |
| auth.users / auth.identities | 0 / 0 |
| storage.buckets / storage.objects | 0 / 0 |
| Roles | anon e authenticated sem bypass RLS; service_role com bypass RLS |
| Extensões | pgcrypto 1.3, uuid-ossp 1.1, plpgsql, pg_stat_statements e supabase_vault disponíveis |
| Funções public/gef_private | Somente `public.rls_auto_enable()`, vinculada ao event trigger `ensure_rls` |

Não há evidência de dados operacionais no projeto. Objetos internos gerenciados pelo Supabase continuam presentes, como esperado em uma instalação nova; não devem ser apagados ou substituídos. As contagens refletem o momento desta auditoria e deverão ser repetidas imediatamente antes da instalação.

Advisors de segurança apontam duas permissões excessivas da função `public.rls_auto_enable()` (`SECURITY DEFINER`): EXECUTE disponível para anon e authenticated. Introspecção confirmou retorno `event_trigger`, owner postgres e `search_path=pg_catalog`. O plano prepara **somente revogação de EXECUTE de PUBLIC/anon/authenticated**, preservando a função e o evento `ensure_rls`; não propõe mudar o owner, remover o gatilho ou convertê-lo para SECURITY INVOKER.

Referências dos avisos: [anon EXECUTE](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [authenticated EXECUTE](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Nenhuma correção remota foi realizada.

O advisor de desempenho traz apenas INFO sobre Auth configurado com máximo absoluto de 10 conexões. Não bloqueia a instalação de desenvolvimento. Reavaliar percentual ao dimensionar a instância: [orientação Supabase](https://supabase.com/docs/guides/deployment/going-into-prod).

## Ordem proposta

Aplicar em transações separadas e registradas, interrompendo no primeiro erro. Nada abaixo é um comando autorizado a executar automaticamente a partir deste documento.

| Ordem | Script em sql/ | Dependência/efeito |
|---:|---|---|
| 1 | development_baseline_permissions.sql | Revoga permissões públicas do event trigger identificado; não remove a proteção RLS |
| 2 | getestimatefast_leads.sql | pgcrypto e tabela de pedidos; nenhum pedido seedado |
| 3 | getestimatefast_marketplace_foundation.sql | Leads, administradores e histórico |
| 4 | getestimatefast_admin_status_rpc.sql | Leads/admin/histórico |
| 5 | admin_approve_lead.sql | Aprovação manual, sem publicação automática |
| 6 | getestimatefast_contractors_foundation.sql | auth.users e perfis/eventos profissionais |
| 7 | contractor_consent_fields.sql | Consentimentos e confirmação de e-mail |
| 8 | contractor_auto_enable.sql | Perfis completos e consentimentos; versão atual da moderação administrativa |
| 9 | opportunity_publication_preview.sql | Leads revisados, perfis e oportunidades |
| 10 | admin_reconfirm_legacy_review.sql | Exige opportunity_previews; incluir para completar o painel administrativo |
| 11 | controlled_matching_rounds.sql | Oportunidades/perfis e seleção controlada |
| 12 | sms_simulation_preview.sql | Destinatários; somente registro de simulação |
| 13 | zenvia_us_webhook_safety.sql | Campos SMS, normalização e histórico de consentimento da #49 |
| 14 | us_marketplace_financial_foundation.sql | Leads/admin/perfis/oportunidades; carteira e origem financeira |
| 15 | us_public_profiles_reviews.sql | Foundation financeira, perfis e avaliações |
| 16 | us_marketplace_read_models.sql | Projeções públicas/privadas, configuração e administração |
| 17 | us_topup_test_contract.sql | Contrato sintético interno da #50; não habilita recargas |
| 18 | us_public_review_rate_limit.sql | Schema privado e limites persistentes |
| 19 | us_portfolio_storage.sql | storage.buckets real do Supabase; bucket somente para fotos consentidas |
| 20 | us_stripe_test_checkout.sql | Pedidos/eventos test-only, reservas e proteção contra estorno na fonte errada |

**Excluir `contractor_admin_review_rpc.sql`**: é a definição antiga de `admin_review_contractor`; aplicá-la depois de `contractor_auto_enable.sql` reintroduziria ativação inicial manual e enfraqueceria as regras atuais. O script de reconfirmação de leads deve vir depois da criação de oportunidades. Os três RPCs administrativos adicionais não estavam todos no bootstrap mínimo da #51; foram incluídos no plano completo.

`scripts/development-installation-plan.js` produz ordem, nomes e SHA-256 dos arquivos locais, com destino fixo e `remote_execution_enabled=false`. Ele não lê secrets, não faz chamadas de rede e não aplica SQL. Conferir esses hashes contra os arquivos efetivamente revisados no momento da aplicação. Usar a versão atual da branch derivada da #51, sem reintroduzir definições antigas de #49/#50.

Os scripts financeiros criam tabelas e não são reaplicáveis indiscriminadamente. `contractor_auto_enable.sql` e `zenvia_us_webhook_safety.sql` têm atualizações de backfill; no banco vazio, antes de qualquer fixture, afetam zero perfis. O bucket usa ON CONFLICT sem corrigir um bucket existente: conferir public, MIME e limite de 3.000.000 bytes após instalação.

## Validação local e diferenças de ambiente

O teste `tests/development-installation-plan.test.js` instala a ordem completa em PostgreSQL 17 nativo local vazio e verifica ausência de seeds operacionais, preservação da moderação atual e grants das RPCs administrativas/financeiras. Auth e Storage usam stubs exclusivamente locais; pgcrypto é omitido nesse teste de portabilidade, pois a extensão já foi confirmada no projeto remoto e gen_random_uuid é nativo no PostgreSQL usado. O runtime remoto também tem event triggers próprios; sua execução e os advisors precisam ser revalidados depois da instalação autorizada.

Resultado: o teste específico passou, com zero falhas, incluindo revogação das permissões de um event trigger fictício local sem remover sua vinculação. `git diff --check` também foi verificado. Nenhum teste alterou o banco remoto.

As 60 verificações de funcionamento/concorrência da #51 continuam como referência da etapa anterior. Esta etapa adiciona um teste específico da ordem completa; não declara que testes remotos de funcionalidades já foram realizados.

## Sequência após revisão e autorização da instalação

1. Reconfirmar ID/ref/nome e repetir as contagens; abortar se surgirem dados ou tabelas de aplicação inesperados. Nenhum fallback para produção.
2. Registrar as migrações revisadas no projeto **cpjsbijgijeyrwjpuciv** por mecanismo Supabase apropriado. Não copiar ou recriar auth/storage gerenciados. Se usar CLI, descobrir comandos por --help e gerar nomes de migração pelo CLI, sem inventar timestamps.
3. Aplicar por etapas na ordem acima; verificar objetos e grants após cada grupo. Em caso de falha, rollback da transação atual e reauditoria. Não executar DROP/RESET automático para tentar novamente.
4. Executar advisors; verificar RLS em todas as tabelas de aplicação e privadas, ausência de EXECUTE público nas RPCs e preservação do event trigger de RLS. `gef_private` não deve ser exposto pelo PostgREST.
5. Só então criar fixtures explícitas e identificadas como fictícias, por fluxo Auth seguro e sem e-mails/SMS externos. Não insertar usuários diretamente nas tabelas gerenciadas auth.users no projeto remoto. Administrador de teste é uma conta fictícia designada pelo operador, nunca um ID copiado de produção. Valores de preços serão sintéticos, não preços comerciais finais.
6. Configurar separadamente somente Preview com URL `https://cpjsbijgijeyrwjpuciv.supabase.co` e ref `cpjsbijgijeyrwjpuciv`. Secrets serão inseridos pelo mecanismo seguro autorizado, sem exibição. A configuração Vercel permanece fora desta auditoria; a conexão ao projeto precisa ser validada novamente. Production não é alvo.
7. Manter Stripe Checkout não aprovado/desativado, SMS dry_run e leads/email externos bloqueados. Validar Auth → API → dados → UI, Storage real e concorrência antes de habilitar qualquer teste remoto financeiro autorizado.

**Estado final desta etapa: projeto reconhecido e auditado; plano preparado; nenhuma migração, seed, alteração de grants ou configuração remota aplicada.**
