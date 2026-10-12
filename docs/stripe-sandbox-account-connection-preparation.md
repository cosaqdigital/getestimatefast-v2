# Preparação da conexão Stripe Sandbox — conta esperada

12/10/2026. Base: PR draft #60, commit `b96f12bf106601220b2aebb27b310446dc31cb78`. Branch `feat/stripe-sandbox-safety-20261012`. Este documento integra o patch de identidade cuja publicação foi autorizada exclusivamente na PR #60, preservando deployment automático desligado. Nenhuma mudança de infraestrutura, credencial, banco, pagamento ou deployment foi autorizada nesta publicação.

## Identidade registrada

- Empresa: Cosaquevite Corp.
- Sandbox: Área restrita de Cosaquevite Corp.
- Account ID informado pelo usuário a partir do Dashboard: **acct_1UOl9qH5rFe1usWF**.
- Variável proposta: `GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID=acct_1UOl9qH5rFe1usWF`, tipo Config, exclusivamente Preview + branch exata da #60.

É um identificador não secreto. O relato do Dashboard identifica o alvo aprovado; ainda não constitui uma verificação autenticada da chave test. Não houve chamada à API Stripe nesta etapa.

## Verificação server-side preparada localmente

Novo módulo `api/_lib/stripe-account.js` fixa o ID aprovado e exige correspondência exata da Config. O navegador não escolhe a conta. Antes de usar Stripe:

1. Exigir key com prefixo sk_test_, modo test e gates existentes de Development/projeto/branch/SMS/schema.
2. Consultar **GET /v1/account** pela chave efetivamente usada, via `client.accounts.retrieve(null)`, suportado pelo SDK instalado. Não consultar /v1/accounts/:expectedId: uma consulta Connect poderia retornar outra conta acessível sem comprovar a propriedade da chave.
3. Exigir object=account, ID exato e ausência de deleted=true. Não comparar o nome exibido, que pode variar ou estar ausente.
4. Em divergência, resposta inválida ou falha de rede/autorização, recusar operações seguintes. Retornar erro sanitizado, sem chave, conta retornada, e-mail, objeto integral ou causa bruta do provedor.

Pontos protegidos: endpoint Checkout antes de reservar um pedido, helper de criação/recuperação Checkout, webhook após validar assinatura e antes de acessar pedido/evento/sessão, reconciliação antes de leituras/gravações do pedido e de qualquer consulta financeira. Assinatura inválida não produz nem o GET de identidade. Não há cache compartilhado de aprovação; cada operação reconfirma a conta. A janela de criação é conferida novamente depois do GET para preservar a margem de expiração.

O preflight geral continua sem chamadas Stripe; acrescenta apenas `stripe_test_account_configured`. Esse campo demonstra correspondência da Config e não prova uma consulta real de identidade. Não foi criado endpoint administrativo/diagnóstico público e não há migração SQL adicional.

Validação local: `npm test` concluiu **99 testes aprovados, zero falhas, zero ignorados**, em 42,3 segundos. Inclui PostgreSQL descartável, transporte Stripe simulado e novos casos de conta ausente/incorreta, resposta inválida, conta deletada, falha de rede, erro sanitizado, ausência de cache e recusa antes da reserva no banco. Evidência local ignorada: `test-output/stripe-account-pin-full-tests.txt`. Nenhuma credencial real foi carregada nesses testes.

O SDK continua 23.0.0/API 2026-09-30.endive. A constância do Account ID não substitui test key, livemode=false nas sessões/eventos e aprovação de Sandbox. O código não verifica e-mail, documentos ou dados bancários da empresa.

## Estado de infraestrutura conhecido

O schema Development foi conferido na fase anterior: 26 migrações, stripe_sandbox_safety `20261012124009`, SHA-256 `236cc80872be52bbde04b97e37cc2c788a1704ae02b35770407dd2a0ae1ea296`. Esta preparação não modifica o banco nem o arquivo SQL.

Na última consulta, a #60 possuía zero deployments e zero variáveis exclusivas. Preview geral possuía URL Supabase de produção, LEAD_PERSISTENCE_ENABLED=true e metadados de credenciais de e-mail. Nenhum desses Secrets foi lido. É obrigatório criar registros exclusivos do Development antes de implantar; não usar ou alterar os registros gerais.

Vercel: getestimatefast-v2, projeto `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF`, time `team_vRw9eJBijmUFe1SbbOFY5xZs`. SSO permanece ativo; Node 24.x, system envs e OIDC habilitados. O bloqueio de deployment Git automático desta branch permanece no código. A URL exata só poderá ser registrada após emissão e conferência de um deployment autorizado.

Stripe CLI não estava disponível no PATH. O relay existente é uma biblioteca, não um launcher executável; o launcher de captura segura/renovação OIDC ainda precisa de preparação e testes. Não iniciar listen bruto em terminal com gravação: a saída padrão contém whsec_.

## Configurações propostas — 22 registros exclusivos, nada instalado

Todos os itens: Preview + `feat/stripe-sandbox-safety-20261012`, preservando Preview geral, Production e outras branches. Conflito interrompe a configuração, sem force/upsert/delete.

| Nome | Valor/origem proposta | Tipo |
|---|---|---|
| GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF | cpjsbijgijeyrwjpuciv | Config |
| GETESTIMATEFAST_SUPABASE_URL | https://cpjsbijgijeyrwjpuciv.supabase.co | Config |
| GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY | publicável Development, sem exibir | Config |
| GETESTIMATEFAST_SUPABASE_SECRET_KEY | sb_secret_ Development, somente servidor | Secret |
| GETESTIMATEFAST_ISOLATED_BACKEND | true | Config |
| GETESTIMATEFAST_PUBLIC_ORIGIN | alias HTTPS realmente emitido para a branch, sem path/query | Config |
| GETESTIMATEFAST_REVIEW_IDENTITY_SECRET | novo segredo independente, mínimo 32 bytes aleatórios | Secret |
| GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET | outro segredo independente, mínimo 32 bytes aleatórios | Secret |
| GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED | false nesta preparação Stripe | Config |
| GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED | false; sem novos redirects OAuth | Config |
| GETESTIMATEFAST_SMS_MODE | dry_run | Config |
| GETESTIMATEFAST_STRIPE_MODE | test | Config |
| GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID | acct_1UOl9qH5rFe1usWF | Config |
| GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED | **false durante toda a preparação** | Config |
| GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED | true, após reconferir migração instalada | Config |
| GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED | false inicialmente; true somente em etapa de recebimento aprovada | Config |
| GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY | sk_test_ da Sandbox esperada e verificada | Secret |
| GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_SECRET | whsec_ do transporte CLI escolhido | Secret |
| GETESTIMATEFAST_MARKETPLACE_PREVIEW | false | Config |
| CONTRACTOR_SIGNUP_ENABLED | false | Config |
| CONTRACTOR_PROFILE_EDITING_ENABLED | false | Config |
| LEAD_PERSISTENCE_ENABLED | false | Config |

São 17 Config e cinco Secret. Não é necessária Stripe publishable key no Checkout atual por URL server-side. VERCEL_PROJECT_ID, VERCEL_ENV e VERCEL_GIT_COMMIT_REF são system envs: conferir os reais, não falsificá-los.

## Instalação segura das credenciais — procedimento futuro

Preferir cadastro manual em Vercel Settings → Environment Variables, com tipo Secret, target Preview e branch exata, conferindo projeto/time. Obter sk_test_ somente dentro da Sandbox informada. Não criar/rotacionar chave desnecessariamente; se não houver credencial existente autorizada, solicitar autorização própria. Não enviar o valor pelo chat, capturar tela de credenciais ou copiar para relatório/arquivo versionado.

Alternativa automatizada, somente após autorização: ferramenta local lê a credencial por entrada protegida/STDIN ou mecanismo autorizado, mantém em memória e cria a variável com escopo explícito. Nada em argumentos, URLs, tool output ou logs; emitir somente nome/tipo/escopo e resultado. Não puxar variáveis de Production nem descriptografar o Secret geral de Preview.

O whsec_ deverá ser o produzido pelo listen da Sandbox selecionada. Não reutilizar segredo de endpoint cadastrado, de outra conta ou transporte. Capturar stdout/stderr do processo, extrair o segredo em memória e suprimir logs brutos; transferir pelo mesmo mecanismo seguro para o Secret exclusivo. Não usar --print-secret ou --headers contendo tokens na linha de comando. Nenhum endpoint externo precisa ser cadastrado para listen.

CLI recente: instalar apenas distribuição oficial aprovada, conferir versão/help; login de navegador somente para essa Sandbox. A documentação atual permite `stripe login list` e `stripe switch acct_1UOl9qH5rFe1usWF`, sem --live. Se a versão exigir habilitar MCP and CLI access, obter aprovação específica para essa Sandbox, sem habilitação da conta live. Não registrar credenciais adicionais automaticamente.

## Ordem exata proposta, condicionada a aprovações

1. **Publicação do patch:** etapa autorizada exclusivamente na branch da PR #60, preservando deployment automático desligado. Registrar o SHA publicado e conferir PR draft/deployments; demais etapas continuam dependendo de autorização separada.
2. **Operação local:** autorizar instalação/autenticação Stripe CLI somente na Sandbox existente e preparação/teste do launcher com conta fixa, saída redigida e OIDC temporário. Não criar outra Sandbox.
3. **Conferência da key:** mediante autorização de uso seguro da credencial, executar somente GET /v1/account e exigir acct_1UOl9qH5rFe1usWF. Emitir verified=true ou erro genérico. Ainda sem sessões, pagamentos, refunds ou escrita no Supabase.
4. **Segredo do transporte:** autorizar conexão listen sem geração/encaminhamento de eventos até concluir isolamento; filtrar os quatro eventos Checkout. Capturar whsec_ em memória. Não executar trigger/fixtures.
5. **Configuração Vercel:** autorizar criação dos registros exclusivos conhecidos, incluindo Account ID, secrets verificados e baseline Development. Checkout/marketplace/webhook false; origem pendente até emissão do hostname. Conferir apenas nomes/tipos/escopos e Config não sensível; preservar metadata dos registros anteriores.
6. **Primeiro Preview:** autorização específica de deployment Preview a partir do novo SHA Git aprovado, nunca upload deste diretório com arquivos privados não rastreados. Confirmar projeto/time, branch/SHA, READY e SSO. Preflight 503 é esperado enquanto PUBLIC_ORIGIN faltar.
7. **Origem/recebimento:** cadastrar alias HTTPS exato e, após validações, alterar somente webhook flag da branch para true. Ambos exigem autorização; manter Checkout/marketplace false. Segundo deploy condicional, no máximo dois no conjunto aprovado; conferir preflight 200/ready=true e Checkout false.
8. **Teste sem pagamento:** relay loopback com OIDC do mesmo projeto e POST apenas no caminho do webhook. Payload fictício de tipo ignorado, assinado localmente, testa bytes/assinatura e GET da identidade sem criar evento na Stripe ou gravar pagamento. Assinatura errada deve retornar 400; acesso sem autenticação Vercel permanece protegido. Nenhum evento financeiro fabricado para simular sucesso no banco.
9. **Reconciliação preparada:** leituras sem pedidos no Development e testes financeiros somente no PostgreSQL descartável. Primeiro Checkout/cartão de teste requer autorização distinta, assim como fixtures elegíveis, marketplace, pagamento e eventual refund.

## CLI/relay/SSO

Filtrar checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed e checkout.session.expired. Stripe CLI → POST local 127.0.0.1/api/stripe-test-webhook → único Preview aprovado. OIDC em memória no header x-vercel-trusted-oidc-idp-token; não em query/argv/logs. O relay não segue redirects e não abre rotas de administração, não repassa cookies/Authorization de cliente nem respostas privadas.

Conferir renovação/expiração OIDC, erros 401/403, timeout e fechamento do listener. A autorização temporária Vercel é mais ampla que uma rota; o relay a limita operacionalmente ao caminho fixo, sem publicar o token ou o listener. Não habilitar Trusted Sources para Production nem criar exceção/bypass geral de SSO. Esses controles foram conferidos no código e em testes simulados; runtime e CLI reais ainda não foram testados.

## Limites e critérios de aceite

Account ID esperado configura o alvo, mas o check real só estará verificado depois de GET autenticado bem-sucedido. Preflight geral não confirma propriedade da key. Falha da Stripe recusa operações; disponibilidade da consulta de identidade passa a ser requisito, sem cache de aprovação. whsec_ comprova assinatura do transporte e não substitui o check da key proprietária.

Sem schema novo, sem preços comerciais e sem instalação remota neste patch. Permanecem pendentes launcher seguro, credenciais/flags exclusivos, origem/deploy, sessão CLI, assinatura hospedada e conexão test real. A autorização de publicação limita-se ao commit/push de código nesta branch; não autoriza acesso ao Supabase Production, alteração de envs, cadastro de webhooks, sessões/pagamentos/refunds, deploy ou merge.

Referências oficiais: [consulta de conta](https://docs.stripe.com/api/accounts/retrieve), [login e acesso CLI](https://docs.stripe.com/cli/login), [listen sem endpoint externo](https://docs.stripe.com/cli/listen), [Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources).
