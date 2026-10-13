# Etapa 10.2A — preparação e revisão da publicação controlada

Data local: 12/10/2026, America/New_York. Preparação concluída; nenhuma publicação executada. A próxima execução depende da autorização específica da 10.2B solicitada ao final desta preparação.

## Revisão Git e escopo

- Repositório: https://github.com/cosaqdigital/getestimatefast-v2.git.
- Branch de destino: `feat/stripe-sandbox-safety-20261012`.
- HEAD local e remoto da branch, SHA base do próximo commit: `6386dd8f38f45f40056353b9f146b478556e3024`.
- HEAD remoto de main/default: `f6a33278b0a68f1c3d76d1b902e471d5dec4637e`; main não será alterada.
- PR [#60](https://github.com/cosaqdigital/getestimatefast-v2/pull/60): OPEN, draft; head igual ao SHA base; base `feat/review-already-submitted-20261012`. Não haverá merge nem alteração de base/status da PR.
- Index/staging vazio. Há 6 arquivos tracked modificados, todos Stripe. O commit proposto contém esses 6 e 13 novos arquivos: **19 arquivos**.
- Há **46 arquivos untracked excluídos**, individualizados no apêndice: trabalhos OAuth/reviews/UI, documentos Stripe históricos fora do patch e operadores locais antigos, além de dois metadados supabase/.temp. Preservados, sem staging.

Para atender ao inventário desde o início Stripe, o intervalo histórico começa no pai da primeira implementação: `206615aeb4d4beaa24ea952b05c9821955e48277`; o primeiro commit é `15e8f7f8ab7f53c993e3bcef429167d9324f2ea3`. Foram listadas **112 diferenças de arquivos já commitadas** até o HEAD atual. Esse intervalo inclui trabalho anterior de OAuth/reviews/UI e infraestrutura compartilhada: não é a lista do próximo commit. O apêndice distingue essa história do patch pendente. API Stripe, schema/SQL, packages/lockfile e vercel.json já presentes no SHA base não serão alterados pelo patch.

## Manifesto exato do próximo commit

| Categoria | Caminho | Estado |
| --- | --- | --- |
| scripts | `scripts/stripe-preview-launcher.js` | modificado |
| scripts | `scripts/stripe-preview-relay.js` | modificado |
| scripts | `scripts/stripe-relay-adapters.js` | modificado |
| scripts | `scripts/stripe-authorized-deployments.js` | novo |
| scripts | `scripts/stripe-oidc-validation.js` | novo |
| tests | `tests/stripe-safety.test.js` | modificado |
| tests | `tests/stripe-relay-launcher.test.js` | modificado |
| tests | `tests/stripe-relay-adapters.test.js` | modificado |
| tests | `tests/stripe-oidc-diagnostics.test.js` | novo |
| docs | `docs/stripe-authorized-deployment-local-report.md` | novo |
| docs | `docs/stripe-oidc-stage9-read-only-validation-plan.md` | novo |
| docs | `docs/stripe-stage10-readiness-audit-and-publication-plan.md` | novo |
| scripts | `scripts/stripe-operational-control.js` | novo |
| scripts | `scripts/stripe-native-processes.js` | novo |
| tests | `tests/stripe-operational-controls.test.js` | novo |
| docs | `docs/stripe-stage101-operational-fixes.md` | novo |
| tests | `tests/stripe-windows-native.cjs` | novo |
| docs | `docs/stripe-stage1011-windows-validation.md` | novo |
| docs | `docs/stripe-stage102a-publication-preparation.md` | novo |

Scripts: 7; testes: 6; documentação: 6. Não incluir genericamente diretórios, nem usar git add . / git add -A. `test-output/`, `.vercel/` e `node_modules/` estão ignorados. `supabase/.temp/` está **untracked, mas não ignorado**, portanto exige exclusão explícita. Não modificar .gitignore nesta subetapa. Templates .env.example existentes pertencem à história/base, não ao diff proposto; nenhum .env será adicionado.

O manifesto completo com SHA-256 dos **19 arquivos**, SHA-256 do conteúdo LF que será versionado, blob Git esperado e SHA base fica local em `test-output/stage102a-publication-manifest.json`. O recibo final inclui também o hash do próprio manifesto. Ele não integra o commit, evitando autorreferência de hash. Este relatório integra o commit; seu hash final está nesse manifesto local.

Hashes SHA-256 dos bytes locais dos 18 arquivos de implementação/evidência anteriores:

| Arquivo | SHA-256 |
| --- | --- |
| `scripts/stripe-preview-launcher.js` | `79578b9f0654f2f5722d40580caee189afb34febddda4747c196fffda30c7e26` |
| `scripts/stripe-preview-relay.js` | `82060fc4551283591df25589cdc25cd3591cbefa6afecbeeec9caeb7fc878a2d` |
| `scripts/stripe-relay-adapters.js` | `1c3c8caf8db6f6214094d5888b8934ab03122b02e05f085ea27674bbbdad55ae` |
| `scripts/stripe-authorized-deployments.js` | `b08176320079bb1c43c7f37c38a2cda02d315428d6e557f64edce0b376fbf175` |
| `scripts/stripe-oidc-validation.js` | `7eef88be846f9be8df7f5213e19826b48fc443c7edaa7bf939e32b3bb2a71df3` |
| `tests/stripe-safety.test.js` | `18a4f0039a20bf2af738516a70ccb523fc0688e6bca973cc98d5fef64385f176` |
| `tests/stripe-relay-launcher.test.js` | `d20f6bab98989600a23861ab792acf47fc07971aa22001054975de59b648a096` |
| `tests/stripe-relay-adapters.test.js` | `587a74e910c6b8de6e3939ba4f454668fc45df70fb44092bec72806b2dea75f6` |
| `tests/stripe-oidc-diagnostics.test.js` | `1e7ca1dcd3c965836971ce4f4e1a1ec043c1da6852a83e934082e5984a5cdd0a` |
| `docs/stripe-authorized-deployment-local-report.md` | `59b3e26a07a3da9e2bbc0c159a932937c2cb570a2710f2e6298cbf2102a897bd` |
| `docs/stripe-oidc-stage9-read-only-validation-plan.md` | `2927d18b7a63a8646bfbe72f9e23d4bd399c4eca8c6ef7cd5358604a5be5d8a7` |
| `docs/stripe-stage10-readiness-audit-and-publication-plan.md` | `3cac530af87d880c4003319ca8b8f8aca7d0c425ee09ddfbb677dfb1ba86582b` |
| `scripts/stripe-operational-control.js` | `0164a32a2b7bd1d6b1649f5092654e55239c80d319f133aab0521e68ef5e411b` |
| `scripts/stripe-native-processes.js` | `3c2f91bf8316926234f324c1cb080699052cde33f641bbc27526015dab6b8a70` |
| `tests/stripe-operational-controls.test.js` | `bf2fa5e7b98cf79cc0ba71cf4f58dde380b399845f03d5504911140ed66eb449` |
| `docs/stripe-stage101-operational-fixes.md` | `8f33f2cb061b853fe2532a2166719a2dbda7b8c6f1c48e5e2372b4a7637d7008` |
| `tests/stripe-windows-native.cjs` | `5837dbb047480a7a46e72f2b3adf585f831c528f3cd63a7be79092ebb0a451a9` |
| `docs/stripe-stage1011-windows-validation.md` | `9394177ac8a61b23055ed8027cbaafbd063c87b831da56655aa8cfd4c19678bf` |

O Windows usa core.autocrlf=true. Foram registrados tanto o hash local quanto o conteúdo LF e blob Git esperado, para não confundir transformação de line endings com modificação funcional.

## Vercel e segurança

Leituras autenticadas **somente da API de controle**, usando o login CLI existente em memória; sem adquirir OIDC, sem Stripe CLI, sem acessar a aplicação Preview nem endpoints financeiros. Observação em UTC: 2026-10-13T02:46:06.603Z. A rodada final teve 11 GETs, nenhuma mutação ou leitura/decriptação de valores Secret de ambiente. Valores lidos foram somente sete Configs previamente allowlisted. Metadados brutos e credenciais não foram gravados.

| Item | Estado confirmado |
| --- | --- |
| Projeto | getestimatefast-v2 / prj_kA6x5rt1MChiNSQpa6pShHoUSuOF |
| Time | get-estimate-fast / team_vRw9eJBijmUFe1SbbOFY5xZs |
| Integração Git | GitHub cosaqdigital/getestimatefast-v2, repoId 1211705834 |
| Production branch | main |
| SSO / Vercel Authentication | all_except_custom_domains; protege os Previews |
| Marketplace / Checkout / webhook branch-only | false / false / false |
| Schema / Stripe mode / SMS / backend isolado | true / test / dry_run / true |
| Variáveis branch-only Preview | 21 registros; nenhuma alteração |
| Runtime | Node 24.x |

Existe um mecanismo de bypass de automação previamente configurado (metadado de scope automation-bypass), preservado e não utilizado. Não é uma exceção pública de domínio; não se afirma inexistência de todo mecanismo de bypass. Nenhum segredo desse mecanismo foi divulgado, passado a requests ou incluído no manifesto.

`vercel.json` contém `git.deploymentEnabled["feat/stripe-sandbox-safety-20261012"]=false`, preservado no SHA base e na cópia exata. Assim, embora a integração Git exista, o push desta branch **não deve iniciar um deployment automático**. A branch é elegível a Preview por ser diferente de main, mas a publicação hospedada será manual por Git-source/SHA. Referências oficiais: [Git Configuration](https://vercel.com/docs/project-configuration/git-configuration), [Git/Production e Preview](https://vercel.com/docs/git) e [Deployment Protection](https://vercel.com/docs/deployment-protection).

Não há .github/workflows nem .husky no conjunto reconstruído, nem core.hooksPath ou hooks locais ativos detectados. Serviços externos adicionais ao vínculo Vercel não foram inventariados universalmente; a verificação de histórico antes/depois do push continua obrigatória.

## Reprodução e validação final

Foi criada uma cópia independente em `test-output/stage102a-exact-source`, por git archive do SHA base e overlay apenas dos 19 caminhos aprovados, normalizados como no Git. Não recebeu arquivos privados, outros untracked, .vercel, dados de teste antigos ou node_modules existentes. Foi comprovada igualdade da lista de **503 arquivos-fonte** com a união da árvore base e do manifesto.

Dependências instaladas do zero nessa cópia com `npm ci --ignore-scripts --no-audit --no-fund`: 65 pacotes em 12 s, sem mudança no lockfile. npm ls não encontrou problemas. npm audit do lockfile, consulta ao registro npm nesta data: **zero vulnerabilidades relatadas** em todas as severidades; isso não garante ausência de vulnerabilidades desconhecidas.

| Validação na cópia exata | Resultado |
| --- | --- |
| node --test --test-concurrency=1 tests/*.test.js | 291 aprovados, 0 falhas/skips/cancelamentos; 191.803 s |
| node --test tests/stripe-windows-native.cjs | 11 aprovados, 0 falhas/skips/cancelamentos; 36.868 s |
| Sintaxe | 110 JS/CJS válidos |
| Segredos | 438 arquivos textuais examinados; 0 candidatos; 16 ocorrências explicitamente sintéticas |
| Execução nativa sem grant | recusada; 0 spawn |
| Gates default | Checkout/webhook recusados; marketplace exige flag explícita |
| Whitespace | git diff --check aprovado; somente avisos de conversão LF/CRLF |

A suíte de 291 inclui as regressões Stripe/OIDC/ownership e as anteriores de OAuth/SQL/UI. Os 217 testes focados foram aprovados na 10.1.1; nesta subetapa executou-se a suíte completa correspondente a partir da cópia exata, além dos 11 nativos. SQL usa PostgreSQL local descartável; serviços Stripe/Vercel são fixtures nos testes. Nenhum teste executa listener financeiro, Checkout real ou obtém token OIDC real. A inspeção final confirma ausência de processos das fixtures/PG locais.

Evidências permanecem locais: stage102a-exact-full.txt, stage102a-exact-native.txt, stage102a-source-audit.json, stage102a-git-inventory.json, stage102a-vercel-metadata.json, stage102a-npm-audit.json, stage102a-publication-manifest.json e recibo final, em test-output. Dependências, zip/base, snapshot, operadores e métricas não integrarão o commit.

## Plano 10.2B — somente após autorização

1. Revalidar branch/origin, index vazio, hashes dos 19 arquivos e HEAD remoto igual ao SHA base; reconfirmar PR draft/base, project/team, Production branch main, SSO e gates false. Qualquer divergência interrompe a execução: sem force, rebase, merge, reset ou correção remota automática.
2. Fazer staging explícito apenas dos 19 caminhos do manifesto. Comparar lista staged, blobs Git e diff integral; ausência de .env/segredos/cache/outros trabalhos. Mensagem proposta: **fix(stripe): harden preview relay lifecycle and OIDC renewal**.
3. Criar **um commit** e conferir que tem exatamente esse diff e pai igual ao SHA base. Registrar o novo SHA, conferir staging residual e que nenhum hook alterou o escopo. Push somente à branch Stripe, sem force/tags. A PR #60 permanece draft.
4. Conferir GitHub/PR e histórico Vercel após o push. Esperado: nenhum deployment automático devido ao bloqueio da branch. Se houver deployment inesperado, parar e não criar outro; investigar em leitura, sem promoção/remoção automática.
5. Se autorizado explicitamente junto da 10.2B, criar **um único Preview** a partir do novo SHA remoto, pelo Git-source do repositório correto. Não fazer upload deste working tree misto, não usar --prod, não reutilizar deploymentId antigo, não passar projectSettings/env/alias/customEnvironment, não modificar configurações.
6. Para a API oficial POST /v13/deployments?teamId=team_vRw9eJBijmUFe1SbbOFY5xZs, o corpo proposto é o abaixo. target é omitido: a [documentação oficial](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) define Preview como padrão. Antes de enviar, rejeitar qualquer target=production ou SHA/branch/repo divergente. Um timeout não autoriza retry: consultar recibo/histórico pelo novo SHA antes de decidir se uma nova autorização é necessária.

```json
{
  "name": "getestimatefast-v2",
  "project": "prj_kA6x5rt1MChiNSQpa6pShHoUSuOF",
  "gitSource": {
    "type": "github",
    "repoId": "1211705834",
    "ref": "feat/stripe-sandbox-safety-20261012",
    "sha": "<NOVO_SHA_COMMIT_APROVADO>"
  },
  "withLatestCommit": false
}
```

7. Poll somente metadados do novo deployment até READY/ERROR com prazo limitado. Conferir projectId/team/owner, target=null (Preview), SHA e ref Git-source/meta exatos, repoId, URL individual, SSO, gates da branch e alias. Rejeitar Production/retargeting. Não cadastrar automaticamente esse deployment no catálogo existente: o catálogo antigo é histórico e não autoriza operações no novo alvo.
8. Após READY, fazer apenas a verificação não financeira aprovada: um GET sem autenticação à raiz da **nova URL individual**, sem cookies, OIDC, bypass e sem seguir redirects, para confirmar a barreira SSO (401/403 ou redirect de autenticação verificado). Não chamar Checkout/webhook/contatos. Resposta pública inesperada exige parada. Um GET protegido de preflight com OIDC real continua fora desta autorização. Registrar IDs/SHA/status/booleans, sem headers privados ou tokens.

Comandos Git propostos (não executados), em PowerShell. Os guards de hashes/escopo do plano são obrigatórios antes de commit/push, mesmo que os comandos básicos apareçam separados:

```powershell
$publicationManifest = Get-Content -Raw -LiteralPath 'test-output/stage102a-publication-manifest.json' | ConvertFrom-Json
git branch --show-current
git rev-parse HEAD
git remote get-url origin
git ls-remote origin refs/heads/feat/stripe-sandbox-safety-20261012 refs/heads/main
git diff --cached --name-only
# Verificar o hash do manifesto/arquivos contra o recibo aprovado; index deve estar vazio.
$publicationPaths = @($publicationManifest.files | ForEach-Object { $_.path })
git add -- $publicationPaths
git diff --cached --name-only
git diff --cached --check
git diff --cached
# Exigir exatamente 19 arquivos e blobs iguais aos git_blob_sha1 do manifesto.
git commit -m 'fix(stripe): harden preview relay lifecycle and OIDC renewal'
$publicationSha = (git rev-parse HEAD).Trim()
git show --format=fuller --stat $publicationSha
# Validar pai/base e diff do commit; interromper em qualquer divergência.
git push origin HEAD:refs/heads/feat/stripe-sandbox-safety-20261012
git ls-remote origin refs/heads/feat/stripe-sandbox-safety-20261012
```

## Reversão e riscos residuais

- Antes do commit, remover do index apenas os caminhos recém-stageados se a revisão falhar, preservando os arquivos locais. Nenhum reset --hard, clean ou descarte de outros trabalhos.
- Se commit existir mas push falhar/for ambíguo, reconferir o remoto antes de retry; não reescrever histórico nem criar duplicata de commit/deployment.
- Se o Preview falhar, parar a validação e manter gates false. Não promover para Production ou trocar domínios. Uma reversão Git exige autorização específica: git revert <novo_SHA> na mesma branch, revisão/testes e push normal. Deploy automático segue bloqueado, portanto o revert por si não substitui o Preview publicado.
- Se for necessário restaurar a experiência Preview/alias, revisar primeiro a identidade/SSO do deployment anterior e solicitar autorização específica para um único redeploy Git-source do SHA base ou retarget de alias. Não executar isso automaticamente, não reutilizar a antiga autorização para novas operações Stripe, não usar rollback Production. Nenhuma migração/schema/env desta publicação precisa ser revertida, pois não há alterações nesses itens.
- Os 19 arquivos são ferramentas/testes/documentação. Seu build não prova operação real do listener, refresh OIDC remoto, Trusted Sources ou pagamentos. Stripe/Vercel CLI reais permanecem sem validação operacional nesta subetapa. taskkill não oferece a contenção universal de Windows Job Object; timers têm jitter. Strings JS podem manter cópias até GC. O bypass de automação preexistente não foi usado e não será parte do smoke.
- Metadados são um snapshot e devem ser reconfirmados na 10.2B. Pode haver corrida de alias/alteração remota: usar URL individual do novo deployment, verificar identidade e parar em divergência. Não há autorização automática de novo alvo no catálogo.
- Reprodução local limpa passou em Windows; o build Linux da Vercel será uma prova adicional apenas após publicação autorizada. Nenhuma ausência universal de CVEs/segredos é garantida pela varredura de padrões.

**Pronto para solicitar 10.2B no escopo concreto: um commit dos 19 arquivos, push à branch Stripe e, se aprovado explicitamente, um único deployment Git-source Preview do novo SHA, seguido de consultas de metadados e um GET não autenticado à raiz para verificar SSO.** Não há autorização para merge, Production, alterações de ambiente/infraestrutura/segurança, OIDC real, Stripe CLI, listener, Checkout, marketplace, webhook real ou operações financeiras.

## Apêndice — todos os arquivos alterados no intervalo histórico

112 caminhos já commitados no intervalo 206615aeb4d4beaa24ea952b05c9821955e48277..6386dd8f38f45f40056353b9f146b478556e3024; A=adicionado, M=modificado. Inclui trabalhos mistos anteriores; não serão stageados novamente:

```text
A	.env.preview.example
A	.env.stripe-sandbox.example
A	.gitattributes
M	api/_lib/marketplace-access.js
A	api/_lib/preview-target.js
M	api/_lib/public-profile-html.js
A	api/_lib/review-auth.js
A	api/_lib/stripe-account.js
A	api/_lib/stripe-policy.js
A	api/_lib/stripe-reconciliation.js
A	api/_lib/stripe-repository.js
A	api/_lib/stripe-test.js
M	api/admin/_auth.js
M	api/admin/marketplace.js
M	api/contractor/signup.js
A	api/contractor/stripe-test-checkout.js
M	api/lead.js
A	api/preview-readiness.js
M	api/public-profile.js
A	api/reviews/auth-callback.js
A	api/reviews/auth-start.js
A	api/reviews/logout.js
A	api/reviews/session.js
A	api/reviews/submit.js
A	api/stripe-test-webhook.js
M	assets/contractor-portal.js
M	assets/marketplace-admin.js
M	assets/marketplace-portal.js
M	assets/marketplace.css
M	assets/profile-sharing.js
M	assets/review-form.js
A	docs/development-installation-completion-report.md
A	docs/development-installation-execution-report.md
A	docs/development-installation-resume-log.json
A	docs/development-project-verification-and-migration-plan.md
A	docs/evidence/google-reviews/google-review-form-1440.png
A	docs/evidence/google-reviews/google-review-form-390.png
A	docs/evidence/phase3/hosted-admin-mobile.png
A	docs/evidence/phase3/hosted-profile-desktop.png
A	docs/evidence/phase3/hosted-profile-mobile.png
A	docs/evidence/phase3/hosted-results.json
A	docs/evidence/phase3/local-corrected-report-dialog-mobile.png
A	docs/evidence/responsive/moderation-320.png
A	docs/evidence/responsive/profile-after-390.png
A	docs/evidence/responsive/profile-before-390.png
A	docs/evidence/responsive/results.json
A	docs/evidence/responsive/review-form-320.png
A	docs/evidence/review-presence/already-reviewed-1440.png
A	docs/evidence/review-presence/already-reviewed-390.png
A	docs/evidence/review-presence/results.json
A	docs/google-review-implementation-and-installation-review.md
A	docs/google-review-migration-manifest.json
A	docs/google-sign-in-reviews-implementation-plan.md
A	docs/hosted-preview-validation-report.md
A	docs/isolated-preview-provisioning.md
A	docs/isolated-preview-validation-report.md
A	docs/preview-auth-functional-validation-report.md
A	docs/preview-phase2-functional-validation-report.md
A	docs/preview-phase3-review-audit.md
A	docs/preview-phase3-review-validation-report.md
A	docs/public-profile-responsive-validation.md
A	docs/review-already-submitted-validation.md
A	docs/stripe-relay-safe-adapters-local-report.md
A	docs/stripe-sandbox-account-connection-preparation.md
A	docs/stripe-sandbox-security-fixes-and-rollout-plan.md
A	docs/stripe-test-integration.md
A	docs/stripe-webhook-relay-local-preparation.md
M	package-lock.json
M	package.json
M	review.html
A	scripts/development-installation-plan.js
A	scripts/hosted-preview-fixtures.js
M	scripts/local-marketplace-sandbox.js
A	scripts/local-postgres.js
A	scripts/preview-readiness.js
A	scripts/stripe-preview-launcher.js
A	scripts/stripe-preview-relay.js
A	scripts/stripe-relay-adapters.js
A	scripts/validate-google-review-ui.js
A	scripts/validate-responsive-pages.js
A	scripts/validate-review-presence-ui.js
A	sql/development_baseline_permissions.sql
M	sql/us_marketplace_financial_foundation.sql
M	sql/us_portfolio_storage.sql
A	sql/us_stripe_test_checkout.sql
A	supabase/migrations/20261010065908_review_authenticated_identity_foundation.sql
A	supabase/migrations/20261010065922_review_authenticated_submission.sql
A	supabase/migrations/20261010065933_review_authenticated_public_reputation.sql
A	supabase/migrations/20261010065941_review_legacy_classification_audit.sql
A	supabase/prepared-migrations/20261012000100_authenticated_review_presence.sql
A	supabase/prepared-migrations/20261012055452_stripe_sandbox_safety.sql
A	tests/development-installation-plan.test.js
A	tests/google-review-accessibility.test.js
A	tests/google-review-auth.test.js
A	tests/google-review-concurrency.test.js
A	tests/google-review-presence-ui.test.js
A	tests/hosted-preview-safety.test.js
A	tests/local-postgres-lifecycle.test.js
A	tests/marketplace-concurrency.test.js
M	tests/marketplace-dom.test.js
M	tests/marketplace-http.test.js
M	tests/marketplace-security.test.js
A	tests/preview-readiness.test.js
A	tests/review-errors.test.js
A	tests/stripe-account.test.js
A	tests/stripe-relay-adapters.test.js
A	tests/stripe-relay-launcher.test.js
A	tests/stripe-safety-postgres.test.js
A	tests/stripe-safety.test.js
A	tests/stripe-test-http.test.js
A	tests/stripe-test.test.js
M	vercel.json
```

## Apêndice — arquivos pendentes que ficam locais

46 caminhos fora do próximo commit. ??=untracked. Operadores antigos e relatórios históricos Stripe não foram aprovados para inclusão só por terem nome Stripe:

```text
??	docs/google-oauth-development-configuration-preparation.md
??	docs/google-preview-env-baseline-metadata.json
??	docs/google-preview-env-created-metadata.json
??	docs/google-preview-env-final-metadata.json
??	docs/google-preview-smoke-results.json
??	docs/google-review-installation-completion-report.md
??	docs/google-review-installation-results.json
??	docs/google-review-preinstallation-audit.md
??	docs/google-review-preinstallation-comparison.json
??	docs/google-review-preinstallation-evidence.json
??	docs/google-review-preinstallation-supplemental.json
??	docs/google-sign-in-preview-configuration-completion.md
??	docs/hosted-functional-validation-report.md
??	docs/integrated-google-review-validation-preparation.md
??	docs/isolated-preview-configuration-completion-report.md
??	docs/responsive-google-oauth-enablement-report.md
??	docs/review-presence-final-interactive-validation.md
??	docs/review-presence-preview-configuration-status.md
??	docs/review-presence-rpc-installation-and-preview-plan.md
??	docs/stripe-sandbox-phase-a-infrastructure-preparation.md
??	docs/stripe-sandbox-safety-installation-report.md
??	docs/stripe-sandbox-technical-audit-and-first-payment-plan.md
??	scripts/add-responsive-oauth-redirect-local.cjs
??	scripts/add-review-presence-oauth-redirect-local.cjs
??	scripts/audit-google-review-preinstallation.js
??	scripts/audit-integrated-oauth-local.cjs
??	scripts/audit-review-presence-preview-local.cjs
??	scripts/audit-stripe-preview-config-local.cjs
??	scripts/audit-stripe-sandbox-local.cjs
??	scripts/audit-stripe-source-integrity-local.cjs
??	scripts/configure-google-preview-local.cjs
??	scripts/configure-responsive-preview-local.cjs
??	scripts/configure-review-presence-preview-local.cjs
??	scripts/create-private-google-review-invitation.cjs
??	scripts/diagnose-profile-overflow-local.cjs
??	scripts/open-new-review-invitation-local.cjs
??	scripts/read-auth-redirects-local.cjs
??	scripts/read-review-presence-resume-state-local.cjs
??	scripts/review-presence-preview-phase-local.cjs
??	scripts/snapshot-oauth-env-local.cjs
??	scripts/test-google-preview-local.cjs
??	scripts/validate-responsive-oauth-start-local.cjs
??	scripts/validate-review-presence-hosted-local.cjs
??	scripts/verify-first-google-review-local.cjs
??	supabase/.temp/cli-latest
??	supabase/.temp/linked-project.json
```
