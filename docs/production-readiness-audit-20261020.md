# GetEstimateFast — auditoria de readiness, 20/10/2026

## Escopo e conclusão

Branch local `release/us-production-readiness-20261018`, base remota `0e1a62de3fc50c5f842e52f27214257aaaf46a5a`. Worktree exclusivo `getestimatefast-production-readiness`; o checkout antigo e os demais trabalhos foram preservados. Projeto de referência Production `wedsjubkttygxtpkopfj`.

Resultado: preparação local para a próxima revisão, **sem autorização para lançamento comercial**. O funcionamento hospedado relatado pelo usuário foi tomado como contexto, não como evidência de novos testes remotos. Nenhuma consulta, escrita, login, recuperação de senha, envio ou alteração de ambiente foi executada nos projetos hospedados. Não houve push, merge, deploy ou promoção de domínio. Não houve acesso a projetos, contas, dados ou código do Orçamentos Brasil.

Todos os valores secretos foram preservados; nenhum `.env`, arquivo DPAPI ou credencial real foi aberto. Os testes utilizam identidades, senhas, tokens e registros sintéticos, exclusivamente em mocks, PostgreSQL em memória ou clusters locais novos com propriedade registrada.

## Achados por severidade

| Severidade | Achado | Tratamento |
|---|---|---|
| Alta, corrigido | `origin-leads` podia liberar contatos de indicações em Production independentemente do gate comercial. | Bloqueio antes da autenticação/consulta quando o marketplace Production não está aprovado; nenhum contato é lido nesse caminho. |
| Alta, corrigido | A autorização de intake de perfil era independente de `LEAD_PERSISTENCE_ENABLED` e dos gates comerciais. | Modo live exige persistência e aprovação comercial, além das autorizações específicas já existentes. Modo sintético de Preview foi preservado. |
| Alta, corrigido | Publicação administrativa de indicação atribuía termos de preço mesmo com o marketplace desativado. | Caminho comercial bloqueado antes de consultar regras ou executar a RPC de publicação com preço. Leitura administrativa e moderação não financeira continuam independentes. |
| Alta, corrigido | Escrita de public profile/portfolio não respeitava `CONTRACTOR_PROFILE_EDITING_ENABLED`. | As duas ações exigem também o gate de edição; pagamentos continuam sempre bloqueados. |
| Alta, corrigido | Respostas administrativas tardias e contatos de indicação podiam permanecer no DOM após logout. | Invalidação por geração de sessão, limpeza de listas/contagens/contatos e rejeição de resposta antiga. Filtros concorrentes não sobrescrevem a seleção mais recente. Isso não equivale a revogação do token nem a limpeza criptográfica da memória do navegador. |
| Média, corrigido | Falhas autenticadas podiam registrar texto arbitrário de exceções; logs de intake incluíam identificadores do lead. | Logs fixos e sanitizados; falhas de notificação mantêm apenas status técnico, sem contato, payload, identificador ou segredo. |
| Média, corrigido | Chamadas de autenticação/consulta podiam seguir redirects inesperados. | `redirect: error` em login admin/contractor, identificação do usuário, consultas compartilhadas e validação de recuperação Production. Sem mudança de senha ou de configuração. |
| Média, corrigido | Honeypot podia apresentar sucesso antes de verificar que o intake estava fechado. | Intake desativado retorna 503 antes de consumir o corpo, gravar ou enviar: “Nothing was saved or sent”. |
| Média, corrigido localmente | Shells sensíveis sem proteção explícita de cache/CDN nesta configuração. | `no-store`, restrição de indexação, proteção de iframe e referrer em admin, marketplace admin e portal. JSON já usava `no-store`; aplicação hospedada depende de futuro deploy autorizado. |
| Média, pendente | Esta branch ainda contém notificação inline e anexos somente em memória no intake antigo. | Não habilitar persistência de leads até revisar o fluxo durável/outbox/anexos e sua estratégia de transição; nenhum PR de outra branch foi integrado automaticamente. |
| Média, pendente | Metadados, RLS/grants e contratos reais hospedados não foram reconsultados nesta etapa. | Smoke test somente leitura e revisão de metadados precisam de escopo/autorizações apropriados. Nenhum SQL ou permissão foi alterado. |
| Baixa, corrigido | Textos “Development preview”/“isolated preview backend” no portal servido em Production; Contractors dependia de tabela larga. | Texto neutro, estados indisponíveis explícitos e cards no breakpoint de 720px, com labels acessíveis e controles de 44px. |
| Baixa, manutenção | Testes preexistentes tinham expectativas desatualizadas e harness Windows com limpeza automática. | Fixtures corrigidos e harness previamente validado reaproveitado, sem excluir diretórios nem adotar processos antigos. |

## Módulos auditados

### Admin / Contractors

`GET contractors`: autenticação Supabase validada no servidor e associação em `admin_users`, sem depender do marketplace. Projeção explícita de campos, status permitido, 25 registros por página mais um marcador, máximo de página 200, ordenação estável por criação e UID. Schema ausente/resposta inválida resulta em erro genérico, sem converter falha em lista vazia.

`GET contractor-history`: UUID obrigatório, filtro por contractor e até 20 eventos, sem seleção de contato. `POST contractor-review`: administrador verificado fornece o ator da RPC; o cliente não define `p_actor`. Status permitidos e motivo obrigatório permanecem inalterados. A política de ativação automática não foi substituída por aprovação manual; contas legadas `pending_review` continuam exigindo análise administrativa específica, não uma ativação arbitrária no frontend.

Dependências: `admin_users`, `contractor_profiles` (incluindo campos de consentimento), `contractor_verification_events`, `admin_review_contractor`; origem em `getestimatefast_contractors_foundation.sql`, `contractor_consent_fields.sql`, `contractor_auto_enable.sql` e RPC administrativa correspondente. Não se presumiu que apenas a migration de marketplace comprova todos esses contratos.

### Pricing e moderação

`GET/POST admin/marketplace` permanece fechado antes de Auth/RPC com gates false. Abrir o schema não habilita a feature. Requer `VERCEL_ENV=production`, endpoint US Production exato, ambos os gates `GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED` e `GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED`, backend não isolado, SMS disabled e ausência de aprovações conflitantes de Stripe test/Google/recovery de Development.

Dependências principais: `marketplace_price_rules`, `marketplace_promotions`, `profile_service_prices`, `opportunity_previews`, `contractor_public_profiles`, reviews/reports; schema privado `gef_private` para termos, quotes, wallets, ledger, compras, intents e audit; RPCs `gef_admin_marketplace`, `gef_admin_configuration`, `gef_moderate_review`, `gef_resolve_review_report`, e publicação administrativa. Preços/promos reais não foram definidos. `credit`, `adjustment`, `refund` e `confirm-payment` permanecem bloqueados.

### Portal profissional

Login e leitura do perfil próprio continuam disponíveis com gates comerciais false, mediante usuário confirmado; usuário anônimo não é aceito. `GET profile` informa capabilities sem segredos. Dashboard comercial, carteira, histórico de compras e public profile não chamam suas RPCs enquanto o marketplace está fechado; a UI exibe “não disponível” em vez de saldo zero ou configuração Development fictícia. Navegação e leitura pública de oportunidades não concedem compra nem contato; aquisição/top-up/refund/adjustment/Checkout seguem bloqueados pelo backend. Perfil comercial e fotos exigem também o gate de edição.

Dependências: Auth, `contractor_profiles`, `list_contractor_opportunities`, `opportunity_previews`; para o ramo comercial, `gef_dashboard`, `gef_commercial_previews`, perfil público, carteira e respectivos contratos privados. O novo gate de contatos de indicação impede consultar PII enquanto Production comercial está false. Preferência de SMS é consentimento e não envio; não foi convertida em autorização para disparos.

### Website e ambiente

Navegação principal e destinos legais da homepage existem localmente. Formulários mantêm validação, aliases e proteções de Preview; intake fechado agora falha de forma clara antes de parse/honeypot. `profile-request` também não pode abrir um caminho live independente com persistência desativada. Não foram alterados canonical, DNS, domínio, URLs de recovery já aprovadas nem refs de isolamento.

Refs de Development no código de política, testes e validadores permanecem intencionalmente: não são configuração para Production. O texto sintético de public profile só é gerado no modo sintético autorizado. O ramo de consentimento Production continua exigindo versões legais próprias, sem usar `preview-v1`. Review Google permanece indisponível; o erro de feature fechada agora é neutro quanto ao ambiente.

## Testes e método

Novos testes: `production-readiness-audit.test.js` (contratos HTTP simulados em Production com gates false), `production-readiness-ui.test.js` (DOM, logout, requisições concorrentes, capabilities, links e configuração de cache).

Cobertura: admin autorizado e usuário comum negado; lista/histórico/contagens funcionais com marketplace false; paginação e filtros inválidos; schema indisponível; exceções com sentinela sensível não vazam; ator administrativo derivado da sessão; nenhum RPC comercial ou contato com gate fechado; edição de perfil; intake/signup fechados sem envio/gravação; flags acidentais de Google/Stripe/SMS; DOM sem interpretação de HTML fornecido por usuário; privacidade após logout; links legais; labels e CSS mobile.

Regressões preservadas: testes nativos de SQL/RLS/concorrência financeira **somente com dados sintéticos locais**, APIs/DOM, Google, Stripe simulado, pricing e consentimento. O preload bloqueia `fetch` externo por padrão; mocks substituem o transporte. Ele não é um firewall geral de sistema. O harness PostgreSQL usa diretório novo fora dos diretórios históricos, portas distintas de 56215/59178/50001/49176/56961, diário de propriedade, `pg_ctl stop` somente do servidor criado pela execução e preserva diretórios.

Primeira execução completa: 416/419, três falhas em expectativas antigas. Corrigidas sem mexer no comportamento hospedado: mensagem de feature desativada, mock de recuperação que deve validar Auth/membership novamente no POST e teste que confundia INSERT dentro de definição de função com seed executado pela migration. A nova verificação de seeds mantém DO/blocos de execução e rejeita invocação do configurador fora de funções. Fixtures de pricing usam instante sintético fixo. A rodada seguinte passou 419/419; novos ajustes de UI/segurança foram cobertos por 55 testes focados aprovados. Resultado da rodada final registrado abaixo após conclusão.

Não se afirma validação visual em dispositivo real: DOM/CSS e navegação foram testados automaticamente, sem navegador conectado a Production. Não se afirma equivalência dos catálogos simulados com a configuração hospedada atual.

**Resultado final:** `npm test` com concorrência 2: **422 aprovados, 0 falhas, 0 cancelados, 0 ignorados**, em **108,86 segundos**. Os 18 clusters locais novos das três rodadas completas ficaram registrados como `stopped`; os diretórios de dados do harness foram preservados. Nenhuma operação foi direcionada aos recursos antigos. `git diff --check` aprovado. Dependências e lockfile inalterados.

## Próximas ações manuais / autorização

1. Revisar estes commits e autorizar separadamente push/deploy da branch, mantendo domínio e gates inalterados. Nenhum push foi feito nesta tarefa.
2. Autorizar smoke test hospedado **somente leitura** de login admin, Contractors, histórico e contagens; validar contrato de colunas/RPC e RLS/grants sem exportar PII. Não clicar em Save decision/publicação durante o smoke test.
3. Conferir layout em 320/375/768px e desktop, teclado/leitor de tela, sessão expirada/logout e no-store/CDN efetivo após eventual deploy aprovado.
4. Revisar conteúdo jurídico e versões de termos/privacy antes de habilitar signup/edição; a existência de links não substitui essa revisão.
5. Antes de abrir intake, revisar durabilidade de anexos/notificações, limites de upload, spam/rate limiting e estratégia de rollout/rollback do fluxo inline existente.
6. Marketplace, preço/promos, carteira/compras, SMS, Stripe e Google reviews exigem suas autorizações próprias, critérios de aceite hospedados e gates específicos. A aprovação desta auditoria não os habilita.
7. Rollback de código: reaplicar a base/commits anteriores em um novo commit revisável, sem reset destrutivo, sem merge em main e sem alteração de banco. Continuar com todos os gates false. Alterações de permissões/SQL são uma operação separada.

## Integridade e arquivos

Commits locais de implementação:

- `7f3104d` — isolamento das suítes e diário dos recursos PostgreSQL descartáveis.
- `25ff2e1` — gates de Production, autenticação/transportes e logs sanitizados.
- `6b910a9` — correção dos fixtures e contratos dos testes de regressão.
- `a741250` — sessões/DOM privados, Contractors mobile e estados comerciais indisponíveis.
- O relatório é registrado em um commit documental separado. Não houve push.

Nenhum arquivo SQL foi modificado. SHA-256 da migration Production já existente: `ab3081d3db3fa3b51a58f588217a7f66b20747a7fe109c042aacc5c8d2a007fb`. Este hash não autoriza reaplicação.

Arquivos modificados/criados nesta tarefa:

- API: `api/admin/_auth.js`, `contractors.js`, `login.js`, `production-password-reset.js`, `publish-opportunity.js`; `api/contractor/_shared.js`, `login.js`, `marketplace.js`, `origin-leads.js`, `profile.js`; `api/_lib/profile-origin.js`, `review-auth.js`; `api/lead.js`.
- UI/cache: `admin.html`, `assets/admin-readiness.css`, `assets/admin.js`, `assets/contractor-portal.js`, `assets/contractor-ux.js`, `assets/marketplace-portal.js`, `vercel.json`.
- Isolamento/fixtures: `package.json`, `scripts/local-postgres.js`, `scripts/local-marketplace-sandbox.js`, `tests/helpers/offline-fetch.cjs`, `tests/local-postgres-lifecycle.test.js`.
- Testes: `tests/production-readiness-audit.test.js`, `production-readiness-ui.test.js`, `production-admin-password-reset.test.js`, `production-migration.test.js`, `marketplace-dom.test.js`, `marketplace-http.test.js`, `marketplace-pricing.test.js`, `marketplace-security.test.js`, `us-referral-auto-pricing.test.js`.
- Este relatório: `docs/production-readiness-audit-20261020.md`.
