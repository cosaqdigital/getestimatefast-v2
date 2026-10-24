# Instalação autorizada — execução interrompida
> Registro histórico da primeira tentativa. A retomada autorizada concluiu os 20 scripts; veja [relatório final](development-installation-completion-report.md) e [log de versões/hashes](development-installation-resume-log.json).
Data UTC: 2026-10-10. Projeto exclusivo: getestimatefast-development (`cpjsbijgijeyrwjpuciv`).
PR revisada: https://github.com/cosaqdigital/getestimatefast-v2/pull/52
Commit revisado: `8b0a33726e05cab503b636af23a54cfdb47a0da4`.

## Resultado
**3 de 20 scripts aplicados; execução interrompida na primeira falha, no script 4.**
A instalação não está completa. Não houve nova tentativa ou aplicação dos scripts 5–20.

O conector gerou para o quarto script uma versão já usada pelo terceiro:
`ERROR 23505: duplicate key value violates unique constraint schema_migrations_pkey; Key (version)=(20261010023959) already exists`.
O histórico remoto contém apenas três migrações. A função do quarto script, `admin_change_lead_status(uuid,text,text,uuid)`, não existe: nenhuma alteração desse script foi encontrada persistida.

## Auditoria anterior
- Identidade/nome/status ACTIVE_HEALTHY e PostgreSQL 17.11 confirmados pelo conector.
- Zero relações de aplicação, migrações, usuários/identidades Auth, buckets/objetos Storage e dados operacionais.
- Todos os 20 scripts lidos integralmente. Dependências, funções, grants, RLS, transações, índices, restrições e backfills revisados.
- Conteúdo local corresponde ao commit aprovado após normalização CRLF/LF. Hashes abaixo distinguem bytes do checkout Windows dos blobs Git, pois quebras de linha alteram SHA-256.
- Ordem idêntica à documentação da PR. Nenhuma definição antiga de contractor_admin_review_rpc.sql foi incluída.
- Nenhum SQL contém entrega de SMS ou chamada Stripe; os módulos financeiros são internos e test-only.
- Testes anteriores à execução: 61 aprovados, 0 falhas.
- Testes automatizados repetidos após a interrupção: 61 aprovados, 0 falhas (36,3 segundos). Incluem concorrência com sessões independentes, idempotência, saldo negativo, estornos, privacidade, APIs, DOM e transporte Stripe sintético. Esses testes usam bancos locais e dados fictícios; não chamam Stripe/SMS reais nem substituem a validação dos módulos ainda não instalados remotamente.

## Registro completo
| Ordem | Script | Resultado | Versão remota |
|---:|---|---|---|
| 1 | development_baseline_permissions.sql | Aplicado | 20261010023945 |
| 2 | getestimatefast_leads.sql | Aplicado | 20261010023958 |
| 3 | getestimatefast_marketplace_foundation.sql | Aplicado | 20261010023959 |
| 4 | getestimatefast_admin_status_rpc.sql | Falhou; interrompido | — |
| 5 | admin_approve_lead.sql | Não executado | — |
| 6 | getestimatefast_contractors_foundation.sql | Não executado | — |
| 7 | contractor_consent_fields.sql | Não executado | — |
| 8 | contractor_auto_enable.sql | Não executado | — |
| 9 | opportunity_publication_preview.sql | Não executado | — |
| 10 | admin_reconfirm_legacy_review.sql | Não executado | — |
| 11 | controlled_matching_rounds.sql | Não executado | — |
| 12 | sms_simulation_preview.sql | Não executado | — |
| 13 | zenvia_us_webhook_safety.sql | Não executado | — |
| 14 | us_marketplace_financial_foundation.sql | Não executado | — |
| 15 | us_public_profiles_reviews.sql | Não executado | — |
| 16 | us_marketplace_read_models.sql | Não executado | — |
| 17 | us_topup_test_contract.sql | Não executado | — |
| 18 | us_public_review_rate_limit.sql | Não executado | — |
| 19 | us_portfolio_storage.sql | Não executado | — |
| 20 | us_stripe_test_checkout.sql | Não executado | — |

## Hashes do conteúdo aprovado
| Script | SHA-256 checkout Windows | SHA-256 blob Git da PR |
|---|---|---|
| development_baseline_permissions.sql | 76f5f1db4f67ccb15adf8424ece46018893b94223e9bce7f64d975bcd1327085 | 76f5f1db4f67ccb15adf8424ece46018893b94223e9bce7f64d975bcd1327085 |
| getestimatefast_leads.sql | 2602fcfafa2368764156df7225c5d6bf3ef015c8f68148447864300132b40255 | c041f577a6dfd699de88f9c7f1eed27236448979e8151e642fe93f3b053808bc |
| getestimatefast_marketplace_foundation.sql | fe3a28f8ccf86a9e5cda9167c587c73ae5173436c2d047276d05da4b48ed0435 | 9c10f9340c38b455db18d7d8f6f2127bba1dff18da30a63ba4fba192d058adf6 |
| getestimatefast_admin_status_rpc.sql | be2928340b13a1b2f16cf5168fa4ebdb412f9d12c95fa589f62a0e801f483418 | 30a74e6b64bdb65916e94756060995bf0898bbd1a9d9474b610b6f3faa963291 |
| admin_approve_lead.sql | 9573765259697a8ccedbcb640541b071ee1a35481f34f444ecaf96636619fa48 | e23abdb52f2fa4a3ce7feaa2176924e0f3404558182c31c8e046b9a62c949d92 |
| getestimatefast_contractors_foundation.sql | f4bd149d107b8a6641c8e25fa65e5c670caee05811f58a1e8b1d3cc81fe6b7ff | 3ab26168ce955b92845f6b235019f31b8fbcf5f71deb4f5309bd0ba6199df86c |
| contractor_consent_fields.sql | 3ef81bcbec4360bcce47c065046ef2b216d341eed382fc226235b0ca2ccac43d | 4cfac0b9328e632d4d2942a28ed0babeace675289a738ec320dbacefa91660a2 |
| contractor_auto_enable.sql | 5b0273db881fd622209f969a59cf4816b99d16d89a764d561ac63a39424d432c | fb54efc7946fcc44dfb3531dd2084af3614247d1251da761fcf3e52ad7c524a9 |
| opportunity_publication_preview.sql | 52f52eaff8a6a66807b923b9effbae0f26bdaef6204895dbf5aff8b114d73d2a | 14bc2dfcfdf7d903e5a6ba9819fb013a731836aecc89b98c909756d16b0892fe |
| admin_reconfirm_legacy_review.sql | 727861b7074267161b966d46a7175cb5e8c51935b7ae69e357ae2edafe95868a | 8367fc49e58a225dc54aae46d0bc6e0c1b135bbd3ce4ed0f96458f7cd7d063f2 |
| controlled_matching_rounds.sql | 5466983447c0f4ef0d1b11ee6b26259eb4d657781515eb080d01d928dbf70511 | 0dded021aadf841e05dbdaa2c029e1d8170279c9dbb30b187a0f903123c7dd27 |
| sms_simulation_preview.sql | 7d7c9b24a2476bc1f66cfedb80a837043e270f803a97a8937fa54ecc5b310cc3 | de25add22b82edbc3df66d8de2d222350c801b9717e27df4c9706250bff05909 |
| zenvia_us_webhook_safety.sql | a72987d9cad284a54ea426a9341d1b5c2e3f52adffbf4eef12b8c5870552dc3b | 9066b8aab1e1df3a93f01d247695c037f53e4a366cd26a741d5f62c920fe7045 |
| us_marketplace_financial_foundation.sql | 972ba8bd56042be0f41b97e163cd398ca2a270221fe829512753af16a24159bc | 972ba8bd56042be0f41b97e163cd398ca2a270221fe829512753af16a24159bc |
| us_public_profiles_reviews.sql | 2d37d7919ef8285c36701490675b95f48d0acbe51098f4a4a83f57356e74b147 | 2d37d7919ef8285c36701490675b95f48d0acbe51098f4a4a83f57356e74b147 |
| us_marketplace_read_models.sql | a0b8c7da52a9451df8a5f268fb3897dfb5f47dbb616abf63025e4f7acdab88a3 | a0b8c7da52a9451df8a5f268fb3897dfb5f47dbb616abf63025e4f7acdab88a3 |
| us_topup_test_contract.sql | 1be34c783b178e053230228ceb4d2706c548c471f3f1763534f041b1d319ffbb | 1be34c783b178e053230228ceb4d2706c548c471f3f1763534f041b1d319ffbb |
| us_public_review_rate_limit.sql | a7c87713c93455e1626eb733419a39daa461b1af8dee44f7387daab7d8c31abc | a7c87713c93455e1626eb733419a39daa461b1af8dee44f7387daab7d8c31abc |
| us_portfolio_storage.sql | fd47590cb995eba435bcce3af7c60eb02d6e737de7735ddd32c2df24d4720179 | fd47590cb995eba435bcce3af7c60eb02d6e737de7735ddd32c2df24d4720179 |
| us_stripe_test_checkout.sql | d3218cdf37fa95f5cba4912e13332cdebdbec53f998151f1674b0e585d25e4d2 | d3218cdf37fa95f5cba4912e13332cdebdbec53f998151f1674b0e585d25e4d2 |

## Verificação remota após interrupção
- Três tabelas: public.leads, public.admin_users, public.lead_status_events. Todas com RLS ativo e sem grants SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN para anon/authenticated.
- Oito índices, todos válidos; nenhuma constraint não validada. Incluem chaves primárias, deduplicação submission_token, filtros de leads e histórico por lead.
- Somente rls_auto_enable() em public; SECURITY DEFINER e search_path=pg_catalog preservados, EXECUTE negado para anon/authenticated e ensure_rls ativo.
- Zero linhas nas três tabelas; zero usuários Auth, buckets ou objetos Storage.
- Storage.objects conserva RLS e nenhum policy de aplicação foi criado. Bucket gef-portfolio não instalado, pois script 19 não foi executado.
- Schema gef_private e funções financeiras não instalados. Sua validação remota permanece pendente; não confundir os testes locais da suíte completa com uma instalação financeira remota.
- Stripe Checkout não foi habilitado; nenhuma variável/credencial/ambiente Vercel foi alterado.

## Supabase Advisors
Segurança: **0 ERROR, 0 WARN**; os dois avisos anteriores de rls_auto_enable() desapareceram. Três INFO de [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), esperados na arquitetura de acesso somente pelo backend/service_role com grants de navegador revogados.
Desempenho: seis INFO: uma [FK sem índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) em lead_status_events.actor_user_id; quatro [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), esperados no banco vazio; uma configuração de [Auth com limite absoluto de conexões](https://supabase.com/docs/guides/deployment/going-into-prod).
Não removemos índices úteis de um banco recém-instalado. Preparar posteriormente índice da FK como mudança separada, sem alterar os scripts aprovados silenciosamente.

## Retomada segura
1. Rever esta falha e reconfirmar identidade, histórico de exatamente três migrações, ausência da RPC do script 4 e contagens vazias.
2. Retomar no script 4; não reaplicar scripts 1–3 e não apagar/resetar histórico.
3. Evitar chamadas apply_migration na mesma janela de segundo: aguardar pelo menos dois segundos após cada sucesso e verificar a nova versão antes de prosseguir. Não inventar ou modificar timestamps do histórico.
4. Prosseguir apenas conforme instrução de retomada, mantendo a parada no primeiro erro.
5. Validar todas as tabelas, índices, funções financeiras, grants, RLS, bucket e Advisors após completar a instalação. Testes funcionais remotos exigem fixtures explicitamente fictícias e não habilitam Stripe/SMS.
