# Correções de segurança Stripe Sandbox — base PR #59

Preparação local em 12/10/2026. Branch `feat/stripe-sandbox-safety-20261012`, baseada no commit `29644290ffb0e5b40ecc6cc71723d685ac5e49db` da PR draft #59. Nenhuma instalação remota, configuração de ambiente, sessão Stripe, cobrança, reembolso, webhook externo, deploy ou merge foi executado.

## Implementação

| Problema | Correção |
|---|---|
| Preflight geral exigia Checkout desligado, impedindo autorização posterior | Na nova branch, o preflight da infraestrutura aceita aprovação explícita true/false; autorização de pagamento exige Development, projeto Vercel correto, modo test, SMS dry_run, schema aprovado, marketplace e webhook habilitados. As branches anteriores continuam exigindo Checkout false. |
| Expiração calculada como criação do pedido + 30 minutos | Pedido novo persiste origem e expiração de 40 minutos, com reserva de 45 minutos. A primeira criação exige pelo menos 31 minutos restantes e no máximo 24 horas. Retry mantém parâmetros/idempotency key; sessão vinculada é recuperada por leitura. |
| Getter JSON do runtime Vercel interferia na assinatura | Leitura dos bytes do stream sem acessar `req.body`; limite de 256 KiB, contagem em bytes e rejeição de stream abortado. Removida configuração Next.js sem efeito no runtime Node nativo. |
| Desligar Checkout também bloqueava webhooks pendentes | Flag de webhook independente do marketplace e da aprovação de novas compras. Ambas as operações continuam exigindo isolamento, modo test e schema aprovado. |
| Falha entre criação Stripe e vínculo no banco | Webhook e reconciliação recuperam a sessão após validar identificador do pedido, finalidade, moeda, valor, modo test e client_reference_id. A reserva nunca é estendida. |
| Conciliação ausente | Biblioteca operacional, sem endpoint público ou agendamento, recupera sessão conhecida e registra observações com UUID e origem `reconciliation`, distinta de `stripe_webhook`. |
| Reembolso sintético marcado como concluído imediatamente | Solicitação administrativa passa para `refund_required`, preservando compra/capacidade. Somente confirmação server-side de refund `succeeded`, integral, em USD, vinculado ao PaymentIntent test correto, permite `refunded`. Não há chamada a `refunds.create`. |
| Duplicidade e eventos fora de ordem | Consulta de evento já persistido antes de nova leitura Stripe; eventos pendentes também são duráveis. Locks e constraints mantêm uma compra por confirmação e PaymentIntent único. Paid/refund_required/refunded não regridem com eventos antigos. |
| Webhook no Preview protegido | Relay opt-in em 127.0.0.1, somente POST no caminho exato do webhook, para origem Preview com projeto/branch/SHA conferidos. OIDC temporário em memória, preservando bytes e assinatura; redirecionamentos recusados. Outras rotas e headers de cliente não são encaminhados. |

Limites de 50 a 99.999.999 centavos são limites técnicos de USD/Stripe, não preços comerciais. Compra individual de contato e preparação de perfil permanecem separadas; recarga não é aceita. Liberação de contatos continua false. SDK permanece na versão 23.0.0 e API `2026-09-30.endive` explicitamente fixada.

## Migração preparada — instalação NÃO autorizada nesta PR

Arquivo: `supabase/prepared-migrations/20261012055452_stripe_sandbox_safety.sql`.

SHA-256 (bytes LF): `236cc80872be52bbde04b97e37cc2c788a1704ae02b35770407dd2a0ae1ea296`.

Criado com `supabase migration new stripe_sandbox_safety` e movido para prepared-migrations; fora do caminho de instalação automática. `.gitattributes` preserva LF. Dependências: as 25 migrações anteriores do Development, incluindo fundação financeira, read models, Stripe da PR #51 e RPC de presença da PR #59. Conferir novamente histórico e hash antes de qualquer instalação autorizada.

Alterações exatas:

- `gef_private.test_checkout_orders`: acrescenta `checkout_expires_at` e `checkout_origin`; default de expiração aplica-se apenas a pedidos novos. Acrescenta check de expiração anterior ao fim da reserva. Nenhuma reserva existente é estendida; pedidos legados mantêm os novos campos nulos.
- `gef_private.test_checkout_events`: acrescenta `source` e amplia a constraint `outcome` para admitir `pending`. Mantém dados e trigger de imutabilidade; observações operacionais usam namespace reservado e source explícito.
- Nova tabela privada `test_refund_confirmations`, com refund_id PK, order_id único/FK, payment_id, amount_cents, currency, mode e confirmed_at. RLS ativa, trigger de imutabilidade; SELECT/INSERT somente service_role, sem UPDATE/DELETE para o backend. Índices implícitos de PK e unicidade.
- Novas funções: `gef_prepare_test_order`, `gef_test_event_read`, `gef_recover_test_session`, `gef_reconcile_test_order`, `gef_confirm_test_refund` e engine privada `gef_private.confirm_test_order`.
- Substitui `gef_confirm_test_order` por wrapper com namespace de evento protegido; `gef_refund_test_order` passa a registrar solicitação, sem concluir reembolso. `gef_create_test_order` antigo falha explicitamente para impedir criação pelo contrato obsoleto.
- Funções novas com SECURITY INVOKER, search_path vazio, EXECUTE revogado de PUBLIC/anon/authenticated e concedido somente a service_role. Sem mudanças em usuários/Auth, carteiras, avaliações ou políticas RLS existentes. Sem concessão de UPDATE nos termos persistidos de Checkout.

Riscos de instalação: lock breve nas tabelas; incompatibilidade intencional do RPC antigo de criação e da antiga confirmação sintética de reembolso; pedidos antigos exigem recuperação operacional, sem reabrir janelas. Auditar previamente pedidos, eventos, refunds históricos, grants, constraints e funções; interromper diante de divergência. O teste local preserva um pedido legado e sua reserva. Não reparar histórico automaticamente.

Após aprovação separada: confirmar exclusivamente `cpjsbijgijeyrwjpuciv`, conferir hash/histórico, aplicar a única migração transacional, verificar objetos/ACL/RLS/constraints/dados preservados e Advisors, mantendo Checkout false. Não aplicar a Production.

Rollback operacional: interromper novas compras com Checkout false e marketplace false; manter webhook autorizado para liquidar pedidos existentes e continuar leitura/reconciliação. Preservar tabela, eventos, confirmações e auditorias. Não restaurar o RPC que reconhecia reembolso sem prova do processador. Falha antes do COMMIT reverte a transação; após COMMIT, corrigir por migração progressiva aprovada, sem DROP, exclusão de dados ou reparo automático do histórico. Reverter somente o frontend não desfaz schema nem pagamentos pendentes.

## Configuração futura — exige aprovação

Nada nesta lista foi instalado. Somente Preview da nova branch, Supabase `cpjsbijgijeyrwjpuciv`, projeto `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF`.

Atualização do patch de identidade: conta esperada informada pelo usuário no Dashboard — Cosaquevite Corp, Sandbox “Área restrita de Cosaquevite Corp”, `acct_1UOl9qH5rFe1usWF`. Config proposta `GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID=acct_1UOl9qH5rFe1usWF`, somente Preview desta branch. A conferência autenticada pela API ainda não foi executada. O patch acrescenta GET /v1/account antes de reserva/Checkout, webhook e reconciliação; divergência ou falha bloqueia o fluxo. Publicação do código autorizada exclusivamente na branch da PR #60, preservando deployment automático desligado; configuração e execução remotas continuam pendentes. Plano atualizado em `docs/stripe-sandbox-account-connection-preparation.md`.

| Nome | Tipo/estado inicial |
|---|---|
| GETESTIMATEFAST_STRIPE_MODE | Config: test |
| GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID | Config: acct_1UOl9qH5rFe1usWF |
| GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED | Config: false |
| GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED | Config: false até instalação/auditoria aprovada |
| GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED | Config: false até aprovação da infraestrutura de recebimento |
| GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY | Secret server-side da Sandbox correta |
| GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_SECRET | Secret server-side do transporte autorizado; segredo do CLI não é o de endpoint cadastrado |
| GETESTIMATEFAST_PUBLIC_ORIGIN | Config: origem HTTPS da branch Preview verificada |

Reutilizar a configuração isolada Development por registros próprios da branch; nunca herdar secrets de Production. Manter SMS dry_run, cadastro/persistência pública de leads/entregas externas bloqueados. O preflight é de configuração; não comprova conectividade/schema/conta Stripe. `stripe_checkout_enabled` também não é prova de instalação remota: o RPC preparado e os campos persistidos são exigidos antes de qualquer criação Stripe.

`vercel.json` contém `git.deploymentEnabled` false exclusivamente para esta nova branch, para publicar a PR sem deployment automático. Remover apenas essa regra e fazer deploy requer aprovação específica. Nenhuma configuração remota do projeto ou proteção SSO foi alterada.

## Testes e limitações

Testes locais automatizados: preflight separado e fail-closed, defaults, projeto/branch/Production; quatro eventos Stripe; assinatura inválida/mutada/antiga; stream/getter nativo, corpo grande/abortado; falha de rede e parâmetros estáveis; falhas de bind/confirm; duplicidade por evento e PaymentIntent; eventos antigos após paid; recuperação tardia; reembolso pending/failed/canceled/requires_action versus succeeded; isolamento do relay.

Resultado de `npm test`: **94 testes aprovados, 0 falhas, 0 ignorados** (57,7 segundos). Inclui a suíte nativa de concorrência anterior e a nova suíte Stripe safety. Verificação adicional da migração final em PostgreSQL descartável: 8 testes aprovados, incluindo o teste principal e sete cenários.

PostgreSQL descartável: schema compilado com pedido legado preservado, ACL/RLS invoker reais, duas conexões concorrentes bloqueadas e observadas em pg_stat_activity, última reserva, confirmação duplicada, reembolso confirmado duplicado, limites/ledger/carteira e separação de finalidade. Transporte Stripe e identidades inteiramente sintéticos; nenhuma chave real carregada. Evidência local ignorada: `test-output/stripe-safety-full-test-results.txt`.

Limitações reais:

- Ainda não houve validação do runtime Vercel hospedado nem pagamento Sandbox real. A compatibilidade de bytes foi testada localmente com o getter nativo reproduzido; assinatura/SSO/CLI real permanecem na fase A.
- Confirmar identidade da conta/Sandbox Cosaquevite Corp antes de cadastrar qualquer chave; prefixo sk_test/livemode=false não identifica sozinho a corporação. Pinning adicional de account ID é uma melhoria posterior.
- Reconciliação é uma biblioteca para operação aprovada por pedido/sessão conhecida, sem worker automático, descoberta de sessões por metadata, painel ou fila de alertas. Se uma resposta se perder após a janela, o operador recuperará a sessão conhecida no Dashboard; não reutilizar nova chave nem criar outra cobrança.
- Reembolso parcial, chargeback/disputa e múltiplos refunds por pedido não são automatizados. A confirmação preparada aceita um refund integral sucedido. Criar reembolso, mesmo Sandbox, continua exigindo autorização própria.
- Política de restituição de bônus em compras pela carteira ainda exige decisão comercial; este patch não converte pagamentos Stripe em créditos de carteira nem modifica essa regra.
- A reserva de 45 minutos termina mesmo com atraso de entrega de eventos; pagamento tardio gera refund_required. Essa estratégia prioriza capacidade e precisa ser avaliada no piloto antes da liberação de contatos.
- UI de Checkout, worker operacional, liberação de contatos e preços comerciais finais permanecem fora desta preparação de segurança.

## Primeiro pagamento Sandbox — plano, não execução

1. **Fase A — infraestrutura:** aprovar a migração separadamente; auditar Development e instalar/verificar; confirmar conta Sandbox; aprovar variáveis exclusivas e Preview/SHA, mantendo Checkout false. Habilitar apenas processamento de webhook após preparação. Autorizar um deployment; validar preflight, Auth, DB, privacidade e SSO. Preparar Stripe CLI listen para os quatro eventos e relay local com OIDC temporário do mesmo projeto, sem endpoint externo registrado nem bypass geral. Tokens/segredos somente em memória por mecanismo seguro, nunca argumentos ou logs.
2. **Fase B — Checkout:** obter autorização específica para Checkout test e um único pedido sintético elegível, sem definir preço comercial definitivo. Gerar sessão pelo servidor e pagar com cartão de teste oficial, sem cartão real nem envio externo.
3. **Fase C — confirmação:** verificar assinatura/raw bytes, sessão recuperada, test mode, finalidade, USD/centavos, vínculo e confirmação SQL. Validar que confirmação do navegador não libera contato nem altera saldo da carteira.
4. **Fase D — reconciliação:** desligar novas compras e continuar webhooks; repetir evento e consultar sessão para confirmar uma única compra/fato. Testar cancelamento/expiração/falha com autorização específica para novos casos; validar refund_required. Reconciliação só lê Stripe; qualquer criação de refund precisará de nova aprovação.
5. **Fase E — decisão comercial:** avaliar política de compradores, contatos privados/consentimento, bônus/refunds, preços, UI/operacional e modelo comercial. Nenhuma liberação automática de contatos faz parte deste primeiro pagamento.

Documentação oficial consultada: [expiração Checkout](https://docs.stripe.com/api/checkout/sessions/create), [idempotência](https://docs.stripe.com/api/idempotent_requests), [webhooks](https://docs.stripe.com/webhooks), [refunds](https://docs.stripe.com/api/refunds/object), [Stripe CLI listen](https://docs.stripe.com/cli/listen), [cartões de teste](https://docs.stripe.com/testing), [runtime Node Vercel](https://vercel.com/docs/functions/runtimes/node-js), [Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources), [desativação de deploy por branch](https://vercel.com/docs/project-configuration/git-configuration).
