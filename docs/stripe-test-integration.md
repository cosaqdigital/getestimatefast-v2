# Stripe Checkout — módulo exclusivamente de teste

## Entrega

Continua a PR draft #50 em branch própria. Nenhuma chamada foi feita à conta Stripe Sandbox da Cosaquevite Corp e nenhuma chave real foi solicitada, lida ou exibida. O SDK Stripe foi fixado em `23.0.0`; testes usam transporte fictício e o verificador de assinatura real do SDK.

`api/contractor/stripe-test-checkout.js` prepara cotações calculadas no servidor, pedidos de contato individual e pedidos de criação profissional de perfil. Revalida conta, categoria, ZIP e raio antes de preparar contato. O preço enviado pelo navegador é ignorado. Os pedidos são deduplicados por proprietário/chave de operação; cotações e preços são congelados. Repetir um pedido confirmado retorna seu estado, sem novo Checkout.

O serviço de perfil usa o preço administrativo vigente e um propósito independente. Nenhum pedido de recarga é aceito por esta API. Pagamento direto de contato não credita a carteira: a compra é registrada com origem `stripe_test`. O campo de origem também impede que um estorno de pagamento direto seja convertido em crédito de carteira.

Checkout usa cartão, USD e centavos inteiros, URLs de retorno fixas da origem Preview confiável, metadados mínimos e chave Stripe estável por pedido. O código rejeita chaves live, eventos live e sessões live. As URLs retornadas devem pertencer a `checkout.stripe.com`.

## Confirmação e estados

`api/stripe-test-webhook.js` recebe bytes brutos (`bodyParser=false`), limita tamanho e verifica `Stripe-Signature` com tolerância de 300 segundos. O evento assinado provoca recuperação server-side da sessão, seguida da validação de ID, proprietário/pedido, propósito, modo, moeda, valor, estado e payment_intent. O redirect de sucesso não confirma pagamento e não libera contato.

Eventos preparados: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `checkout.session.expired`. Eventos não relacionados são ignorados depois da validação. Erros transitórios retornam 503 para permitir retry; assinaturas inválidas retornam 400. Não são registrados payloads, secrets ou detalhes de pagamento.

Pedidos reservam capacidade por 31 minutos; a sessão Checkout expira em 30 minutos. Reservas válidas contam junto às compras na proteção de limite. Publicação, aquisição e confirmação seguem a ordem lead → oportunidade → pedido → carteira. Falha/expiração confirmada libera a reserva. Apenas voltar pelo link “cancel” mantém o pedido pendente até a sessão expirar; não interpreta navegação como prova de cancelamento.

Confirmações pagas têm precedência sobre eventos atrasados de falha/expiração. IDs de eventos são imutáveis e conflitos de payload são rejeitados. Se o pagamento chegar após expiração da reserva, alteração da publicação ou perda de elegibilidade, o pedido vai para `refund_required`, sem aquisição nem contato. Essa opção conservadora evita vender além da capacidade; política comercial e reconciliação operacional ainda precisam definição.

`gef_refund_test_order` é apenas um reconhecimento interno sintético para testes de estado/idempotência. Não chama a API Stripe de refund. Um estorno futuro do processador precisará confirmação própria, auditoria e reconciliação; não tratar esse RPC como reembolso bancário.

## Travas e configuração posterior

As rotas ficam bloqueadas por padrão. A UI existente continua com botões financeiros desativados. Não foi habilitado Checkout remoto, mesmo em Sandbox.

Somente após aprovação específica do teste/modelo comercial e instalação no backend exclusivo, configurar seguramente no Preview da branch:

| Nome | Escopo/uso |
|---|---|
| `GETESTIMATEFAST_STRIPE_MODE` | Config, valor `test` |
| `GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED` | Config, manter `false` nesta entrega |
| `GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY` | Secret server-only da conta Sandbox correta; exclusivamente chave test |
| `GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_SECRET` | Secret server-only do endpoint Sandbox específico |
| `GETESTIMATEFAST_PUBLIC_ORIGIN` | Config, origem HTTPS da branch Preview |

Também são obrigatórios o modo isolado e as variáveis Supabase próprias de desenvolvimento, conforme [provisionamento](isolated-preview-provisioning.md). Não há necessidade de chave publicável Stripe neste fluxo hosted Checkout, porque o servidor devolve a URL da sessão. Não usar variáveis públicas para secrets. Não colar chaves em chat, PR, código ou comandos.

Em etapa autorizada futura, registrar o endpoint `/api/stripe-test-webhook` somente no Sandbox e selecionar os eventos acima. Ajustar a proteção do deployment para que Stripe possa atingir o endpoint sem remover proteção de outras rotas. Testar entregas e retries com os cartões de teste documentados, sem copiar pagamentos reais. Confirmar que o ambiente pertence à Cosaquevite Corp pelo painel autorizado, sem publicar identificadores privados ou credenciais.

## Limites e próximos passos

- O módulo foi exercitado com SDK/verificação de assinatura reais, handlers HTTP, banco SQL e transporte Stripe simulado. Ainda não houve teste com o Stripe Sandbox remoto.
- Preparação de cotação e matching são server-side; confirmação revalida estado da conta e publicação. Para liberar contatos futuramente, revalidar também a cobertura/categorias no instante de fulfillment e definir consentimento/política de acesso. Nenhuma rota desta entrega expõe o contato adquirido.
- Serviço de criação de perfil registra pagamento separado, mas não abre uma tarefa operacional para a equipe nem executa a preparação do perfil.
- A UI de pagamentos e os read models de pedidos Stripe ainda precisam integração em uma etapa autorizada. O GET autenticado da API permite consultar status do pedido sem divulgar contatos ou dados de pagamento.
- Expiração exige monitoramento/reconciliação de sessões que não consigam criar/bindar após falha transitória; capacidade se libera ao terminar a reserva. Falhas de bind devem ser recuperadas repetindo a mesma operação/chave.
- Chargebacks, assinatura de refunds do processador, reversões e confirmação operacional de reembolsos seguem fora deste módulo preparatório. Live mode e recargas permanecem proibidos.

Referências primárias: [SDK stripe-node e raw body](https://github.com/stripe/stripe-node), [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment), [gestão e assinatura de webhooks](https://docs.stripe.com/events/manage-webhook-endpoints), [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create).
