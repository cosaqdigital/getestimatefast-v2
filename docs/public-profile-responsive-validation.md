# Validação de responsividade dos perfis públicos

Branch: feat/public-profile-responsive-20261011, baseada no commit da PR draft #57. Ambiente permitido: Vercel Preview do projeto getestimatefast-v2 e backend Development cpjsbijgijeyrwjpuciv, somente leitura.

## Causa e correção

No Preview anterior, a 390 px, o parágrafo de comentário da avaliação, dentro de article.card, contém um texto de 45 caracteres cuja linha alcança 445 px. O card termina em 359 px e o parágrafo em 340 px; o texto excede seus limites porque overflow-wrap é normal. Medição por Range.getClientRects confirma que a causa é o texto, não a imagem ou o formulário de compartilhamento. Overflow total: 55 px.

O CSS permite quebra de palavras longas com overflow-wrap:anywhere, preservando o conteúdo. Containers e filhos de grid podem encolher; botões quebram texto, têm largura máxima de 100% e altura mínima de 44 px; controles não ultrapassam o container; o campo de compartilhamento ocupa sua própria linha; o diálogo de denúncia tem largura limitada ao viewport. Botões primários de compartilhamento/contato usam a cor de contraste já adotada nas avaliações. Não foi usado overflow-x:hidden, truncamento de comentários ou remoção de conteúdo.

A lista de branches de Preview recebe apenas a nova branch para permitir o preflight de isolamento. Não há mudança nas regras de Auth, identidade Google, unicidade, autoavaliação ou moderação. Nenhuma alteração de banco foi preparada ou aplicada.

## Verificação inicial local

| Largura | Perfil com textos longos | Formulário Google | Moderação | Overflow |
|---|---|---|---|---|
| 320 px | aprovado | aprovado | aprovado | 0 px |
| 375 px | aprovado | aprovado | aprovado | 0 px |
| 390 px | aprovado | aprovado | aprovado | 0 px |
| 430 px | aprovado | aprovado | aprovado | 0 px |

Verificações incluem diálogo de denúncia, retorno do foco, rótulos, navegação por teclado, outline de foco, mensagens longas de erro e preservação integral dos textos. Zero exceções JavaScript nos cenários testados. O executor scripts/validate-responsive-pages.js usa fixtures interceptadas no navegador para avaliações e administração; nunca grava no Supabase nem autentica contas Google reais.

## Preview hospedado

Deployment hospedado validado: https://getestimatefast-v2-qbn4fbn4k-get-estimate-fast.vercel.app, READY, Preview, projeto prj_kA6x5rt1MChiNSQpa6pShHoUSuOF, branch feat/public-profile-responsive-20261011, SHA 98b15a56e1d0fb4d437afb560693c96f630cd843. Esse SHA contém toda a correção de CSS e isolamento; commits posteriores acrescentam cobertura/evidências, sem alterar CSS, APIs ou regras de negócio.

Preflight autenticado: HTTP 200, ready=true, stripe_checkout_enabled=false. O stylesheet servido foi comparado integralmente com a revisão local, normalizando apenas CRLF/LF. O perfil existente retornou HTTP 200 e manteve 1 avaliação aprovada, média 5,0/5.

| Viewport | Documento do perfil real | Overflow | Login/formulário/erros | Moderação/erros |
|---|---|---|---|---|
| 320 px | 320 px | 0 px | aprovado com fixtures | aprovado com fixtures |
| 375 px | 375 px | 0 px | aprovado com fixtures | aprovado com fixtures |
| 390 px | 390 px | 0 px | aprovado com fixtures | aprovado com fixtures |
| 430 px | 430 px | 0 px | aprovado com fixtures | aprovado com fixtures |

Passaram também perfis com nomes/comentários/URLs longos, campo de compartilhamento com o link completo preservado, denúncia sem envio, botão Continue with Google, rótulos, foco visível, navegação por teclado e retorno do foco ao fechar o diálogo. Zero exceções JavaScript. Todas as mutações de avaliação/moderação foram respondidas por fixtures no navegador: zero gravações remotas. Somente GET de imagens públicas do bucket Development foi permitido fora da origem Vercel; notificações e navegações externas foram bloqueadas.

Evidências publicáveis, com nome/comentário da avaliação ocultados sem alterar layout ou registros:

- [Antes: documento de 445 px no viewport de 390 px](evidence/responsive/profile-before-390.png).
- [Depois: documento de 390 px no viewport de 390 px](evidence/responsive/profile-after-390.png).
- [Formulário de avaliação a 320 px](evidence/responsive/review-form-320.png).
- [Moderação a 320 px](evidence/responsive/moderation-320.png).
- [Medições de navegador nas quatro larguras](evidence/responsive/results.json).

Foi criada a PR draft #58, com base feat/google-review-auth-20261010. O alias exclusivo é https://getestimatefast-v2-git-feat-public-pro-47b1bd-get-estimate-fast.vercel.app.

Para não herdar o backend de outras branches, foram criados 17 registros exclusivos de Preview + feat/public-profile-responsive-20261011. Inventário e timestamps dos registros anteriores permaneceram iguais, incluindo Production e Preview geral. Não foi utilizado force, upsert ou exclusão.

| Variável | Tipo | Configuração |
|---|---|---|
| GETESTIMATEFAST_SUPABASE_URL | Config | https://cpjsbijgijeyrwjpuciv.supabase.co |
| GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY | Config | chave exclusivamente Development; omitida |
| GETESTIMATEFAST_SUPABASE_SECRET_KEY | Secret | chave exclusivamente Development; omitida |
| GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF | Config | cpjsbijgijeyrwjpuciv |
| GETESTIMATEFAST_ISOLATED_BACKEND | Config | true |
| GETESTIMATEFAST_PUBLIC_ORIGIN | Config | alias exclusivo acima |
| GETESTIMATEFAST_REVIEW_IDENTITY_SECRET | Secret | novo e independente; omitido |
| GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET | Secret | novo e independente; omitido |
| GETESTIMATEFAST_SMS_MODE | Config | dry_run |
| GETESTIMATEFAST_STRIPE_MODE | Config | test |
| GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED | Config | false |
| CONTRACTOR_SIGNUP_ENABLED | Config | false |
| CONTRACTOR_PROFILE_EDITING_ENABLED | Config | false |
| LEAD_PERSISTENCE_ENABLED | Config | false |
| GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED | Config | true; schema já instalado |
| GETESTIMATEFAST_MARKETPLACE_PREVIEW | Config | true; backend Development isolado |
| GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED | Config | false somente na nova branch |

O Google OAuth do Preview da #57 permanece intacto. Um novo teste interativo real nesta branch exigiria cadastrar seu redirect /api/reviews/auth-callback no Supabase; essa configuração não foi alterada nem o fluxo habilitado aqui. O formulário e a moderação são exercitados com fixtures de navegador, para verificar somente layout, acessibilidade e erros, sem contornar a autenticação de APIs reais. O perfil existente é consultado pelo backend real Development, somente leitura.

Nove testes existentes de Auth/PKCE, privacidade, acessibilidade, preflight e isolamento passaram, sem falhas. No navegador, os botões verificados têm contraste de texto >=4,5:1 e altura >=44 px; foco e retorno do foco do diálogo passaram. A verificação não constitui auditoria completa de conformidade WCAG.

Production, main, Orçamentos Brasil e o Preview da PR #57 permanecem intactos. Sem merge, envio externo, pagamento ou alteração de configuração Supabase/OAuth.
