# Etapa 10.0 — auditoria de prontidão Stripe e plano de publicação

Data: 12/10/2026. Repositório local `cosaqdigital/getestimatefast-v2`, branch `feat/stripe-sandbox-safety-20261012`, HEAD `6386dd8f38f45f40056353b9f146b478556e3024`. A cadeia pretendida permanece na PR draft #60; seu estado remoto não foi reconsultado nesta auditoria.

**Parecer: pronto para preparar correções/publicação revisada; NÃO APTO para iniciar listener real ou Checkout ainda.** A Etapa 9 foi aprovada para OIDC → GET protegido, mas não substitui validação do executor real, renovação, webhook e processamento financeiro.

## Escopo e evidência

Foram revisados os arquivos pendentes das etapas 8/9.1, relatórios 8/9, operadores locais de 9/9.2/9.3/9.5 e recibos sanitizados; 9.4 teve somente documentação e consultas. Também foram revisados Checkout, política Stripe, identidade da conta, webhook/raw body, reconciliação, SQL base/segurança e testes relacionados.

Nesta etapa houve somente leitura local, geração deste relatório/evidências locais, testes sintéticos e PostgreSQL descartável. As únicas leituras externas foram documentação oficial pública. Não houve consultas autenticadas adicionais a GitHub/Vercel/Supabase/Stripe, novos tokens OIDC, operações Stripe, listener, deploy, alteração de infraestrutura ou Git de publicação.

Evidência hospedada reutilizada da 9.5: deployment `dpl_AbusK9zKzKP8Ddejvu6VgNyV6jsx`, origem individual `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app`, SHA acima, identidade reconfirmada, SSO preservado, uma aquisição OIDC em memória e um GET com HTTP 200/JSON esperado. Foi descartado o token Development de validade emitida 12 horas. **Nenhum acesso hospedado foi repetido na 10.0.**

## Manifesto de publicação proposto

Adicionar somente estes **12 arquivos**, cada um pelo caminho exato. Não usar `git add .`, `git add -A` ou inclusão genérica de diretórios.

| Categoria | Arquivo | Estado local |
| --- | --- | --- |
| Script | `scripts/stripe-preview-launcher.js` | Modificado |
| Script | `scripts/stripe-preview-relay.js` | Modificado |
| Script | `scripts/stripe-relay-adapters.js` | Modificado |
| Script | `scripts/stripe-authorized-deployments.js` | Novo |
| Script | `scripts/stripe-oidc-validation.js` | Novo |
| Teste | `tests/stripe-safety.test.js` | Modificado |
| Teste | `tests/stripe-relay-launcher.test.js` | Modificado |
| Teste | `tests/stripe-relay-adapters.test.js` | Modificado |
| Teste | `tests/stripe-oidc-diagnostics.test.js` | Novo |
| Documento | `docs/stripe-authorized-deployment-local-report.md` | Novo |
| Documento | `docs/stripe-oidc-stage9-read-only-validation-plan.md` | Novo |
| Documento | Este relatório, `docs/stripe-stage10-readiness-audit-and-publication-plan.md` | Novo |

**Aplicação/API, schema, pacote/lockfile e vercel.json:** nenhuma alteração pendente destas etapas. Checkout e webhook existentes já pertencem ao commit publicado. A maior parte dos scripts novos é ferramenta local, não código executado pelas rotas hospedadas.

Não publicar `test-output/` (operadores, recibos, auditorias, logs e clusters); `.vercel/`; `.env*`; `supabase/.temp/`; credenciais, tokens, cookies ou convites. Existem muitos outros arquivos untracked de etapas anteriores de OAuth/Supabase/Stripe: não pertencem ao manifesto e devem permanecer intactos. Não foram considerados aprovados apenas por estarem no diretório.

Não incluir automaticamente a reprodução operacional desta auditoria nem os antigos helpers que podem modificar infraestrutura. Se futuras correções acrescentarem arquivos ou alterarem os listados, revisar novamente o manifesto antes de staging.

## O que funciona localmente

- Catálogo congelado com escolha explícita `pr60-stage7`: fixa deployment/SHA/URL individual/projeto/time/repositório/branch. O alias só verifica identidade; POST vai exclusivamente ao hostname individual. Metadata do caller não concede acesso a outro Preview.
- Identidade conferida no início e nas fronteiras de envio; recusa Production, campos ausentes, alias movido, URL divergente e SSO incompatível. Prazo fixo de 10 s no verificador; erros bloqueiam o relay e encerram o launcher.
- OIDC: RS256/JWT, issuer oficial global/team, audience/subject/nomes/IDs fixados, Development/Preview, iat/nbf/exp em segundos, mais de 30 s restantes, assinatura via discovery/JWKS oficial e rechecagem temporal. 46 diagnósticos sanitizados; token somente decodificado não autoriza envio.
- Relay: IPv4 127.0.0.1, Host exato, POST/caminho exato, 256 KiB inclusive chunked, 16 operações simultâneas, até 20 s, bytes/Stripe-Signature preservados; não encaminha cookies/Authorization ou resposta privada; rejeita redirects/401/403 e invalida OIDC; 503 não dispara retry automático do payload.
- Executor/adaptadores: shell:false, caminhos executáveis revisados, diretório sem .env, ambiente herdado filtrado, pipes privados e ownership de processos simulados. **Ainda não existe executor real autorizado conectado ao launcher.**

## Riscos e correções pendentes

| Prioridade | Achado | Medida proposta, não implementada nesta auditoria |
| --- | --- | --- |
| Bloqueador de processos reais | `launcher.stop()` usa allSettled e marca closed antes da limpeza. Falha de stopSynthetic fica oculta, e novo stop não tenta novamente. | Manter/joinar promise de encerramento, reportar código sanitizado de cleanup e ownership dos filhos não encerrados; permitir limpeza explícita limitada e comprovar encerramento/porta. Não declarar sucesso parcial como limpeza completa. |
| Bloqueador do executor real | Funções de início/execução aceitam somente modo synthetic e dependências mock. | Implementar adaptador real com escopo de autorização separado, sem trocar mock por spawn/fetch silenciosamente; reconfirmar identidade e modo test antes do listener. |
| Bloqueador de operação contínua | Três processos Vercel CLI sequenciais excederam 10 s na 9. O relay faz duas verificações por request e tem prazo total 20 s. | Preparar leitura estruturada eficiente/persistente com cancelamento, timeout e redirects bloqueados. Não aumentar prazo nem usar snapshot como autorização permanente para fazer passar. Medir custo antes do listener. |
| Alto, disponibilidade | Lookup JWKS pode consumir até 10 s por documento (discovery/chaves); aquisição/identidade na inicialização dependem de prazos próprios dos adaptadores. | Deadline total/cancelamento coordenado no executor real, cache de chaves públicas limitado e política de refresh/rotação; testar fontes lentas e parada durante aquisição. |
| Alto, confiança no runtime | env run injeta outras variáveis Development e pode carregar/sobrepor .env/ambiente local. | Diretório vazio e environment filtrado obrigatórios; revisar acesso a outras variáveis ou preferir mecanismo oficial dedicado a OIDC. Não executar do checkout nem exportar env pull. |
| Alto, diagnóstico | O manager preserva código OIDC, mas o catch externo do launcher volta a mensagem genérica. | Preservar categoria/code allowlisted até o operador, sem original error/cause/claims. Não expor ao endpoint público. |
| Operacional | Renovação é simulada; token real da 9.5 foi obtido uma única vez. | Plano operacional separado abaixo; não alegar refresh real comprovado. |
| Operacional | O whsec do listener futuro pode variar; gate e secret devem corresponder à mesma sessão autorizada. | Captura privada em memória, mudança encerra operação; instalação branch-only/redeploy somente com aprovação específica e coordenação de sessão. Sem bypass público de SSO. |
| Operacional | SDK Stripe tem timeout 15 s e até dois retries; processamento soma GET account/session e RPCs, podendo superar os 20 s do relay. | Medir latência real em etapa aprovada, preservar idempotência e confirmar recuperação após timeout. Avaliar fila durável para operação futura, sem implementar nesta etapa. |
| Publicação/deployment | Publicar muda HEAD, mas o catálogo fixa o deployment antigo. Helpers 9 também exigem HEAD igual ao SHA do alvo. Alias pode mudar após deploy. | Separar identidade da ferramenta local da tupla da aplicação alvo. Autorizar nova tupla explicitamente após eventual deployment; não atualizar automaticamente catálogo/alias nem exigir que um commit contenha seu próprio SHA. |
| Privacidade/negócio | Pagamento confirmado test pode gerar purchase sintética acquired/capacidade no Development, mesmo retornando contact_release_enabled=false. | Apenas oportunidades/contatos fictícios. API de contatos permanece ausente/bloqueada; liberação futura exige revisão independente de consentimento/matching/privacidade. Não confundir flag de resposta com ausência de escrita interna. |
| Dependências | Pacotes pinados sem alterações; nenhuma instalação/audit de vulnerabilidades remoto nesta etapa. | Pipeline/advisories de dependências antes de uso prolongado; não afirmar ausência de CVEs. Dependência PostgreSQL embedded é somente de desenvolvimento. |

O primeiro achado foi **reproduzido localmente** em `test-output/stage100-stop-failure-reproduction.cjs`: stop retornou fulfilled após erro simulado de término; segundo stop não chamou limpeza novamente. Não houve processo real, token real ou tráfego remoto nessa reprodução. O loopback foi fechado; o risco é um processo filho real não encerrado e erro oculto. Nenhuma correção de código foi aplicada fora do escopo de auditoria.

## Checkout e segurança financeira existentes

O servidor exige usuário profissional e elegibilidade, faz quote USD em centavos conforme regras configuradas, reserva inventory via RPC e cria sessão por chave idempotente `gef-test-order:<order>`. Contact e profile_service são propósitos independentes; não há topup neste módulo. Perfil preparado pela plataforma ainda não abre tarefa operacional de entrega.

Expiração fica persistida/imutável (40 min) dentro da reserva (45 min), com validação de janela de criação segura e posterior recovery por sessão conhecida. Os limites oficiais são 30 min–24 h, conforme [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create). Falha ambígua não muda parâmetros/idempotency key. Cancel URL não confirma cancelamento/pagamento; redirects são informativos.

Gates independentes: Checkout exige marketplace + aprovação Checkout + schema + webhook aprovados; webhook exige scope isolado/test/schema/gate próprios e pode processar pendências com novas compras desabilitadas. Chave deve ser sk_test, conta owner deve corresponder a `acct_1UOl9qH5rFe1usWF` por GET /v1/account, session/event/payment observados devem ser test. Não há função de criação de refund no módulo de reconciliação.

A API atual bloqueia purchase/topup/refund/adjustment da carteira; não há desbloqueio automático por preflight ready. Profile_service é independente da carteira, créditos não são criados por um pagamento de contato. Live/Production não são permitidos pelo scope. Só dados sintéticos são adequados para os testes restantes.

## Autenticação, eventos, duplicidade e reconciliação

Há duas autenticações distintas: OIDC para passar Deployment Protection; Stripe-Signature/whsec para autenticar bytes do evento. Passar SSO não autentica um evento financeiro.

O webhook é POST e preserva raw stream sem ler getter JSON; limite 256 KiB. SDK constructEvent valida assinatura/timestamp (300 s), antes de GET account/session ou confirmação. O segredo do CLI listener é diferente de um endpoint registrado, conforme [Stripe webhooks](https://docs.stripe.com/webhooks); não são intercambiáveis.

Eventos snapshot suportados:

| Evento | Tratamento |
| --- | --- |
| checkout.session.completed | Confirma paid só se sessão recuperada está complete/paid; caso contrário pending |
| checkout.session.async_payment_succeeded | Mesma confirmação server-side |
| checkout.session.async_payment_failed | Failed conforme estado recuperado; não desfaz estado terminal |
| checkout.session.expired | Expired conforme estado recuperado; não desfaz paid/refunded |

O listener preparado filtra esses quatro eventos de @self. Sem --live, seleção automática de conta ou novos endpoints públicos. Atualmente Checkout permite apenas card; testes reais de métodos assíncronos não estão liberados por aceitar esses eventos.

Evento assinado dispara retrieve da sessão; comparam-se order, purpose, referência, modo, currency e amount. Mesmo depois do redirect de sucesso, banco só muda por confirmação server-side. Evento já persistido retorna duplicate; SQL serializa IDs de eventos, idempotency keys e locks de oportunidade/pedido/carteira. UNIQUEs de evento, sessão, payment, purchase e refund protegem duplicação concorrente. Estados terminais preservados; pagamento atrasado/inventário invalidado vira refund_required.

Schema SQL local revisado: gef_private/RLS, grants restritos a service_role para RPCs financeiras; anon/authenticated sem execução direta. Reservas contam no limite de compradores e não podem ser ignoradas por compra via carteira. Histórico/auditoria preservados. Não houve reconferência remota dos 26 registros instalados ou advisors nesta auditoria; testes SQL descartáveis verificam o código e permissões preparados.

Reconciliação é biblioteca de operador, sem endpoint público, cron ou criação de cobrança/refund. Distingue source reconciliation/event IDs próprios, recovery sem estender reserva e refund_required de refunded. Refunded só após consultar payment/refund correspondentes e sucesso do processador. Essa conciliação **escreve no banco** mesmo usando consultas Stripe de leitura; requer autorização de mutação do Development em etapa futura. Não executá-la sob autorização genérica de leitura.

## Procedimento separado de validação operacional OIDC

1. Aprovar orçamento de requisições/tokens e apenas GET ao preflight do deployment fixado; nenhum listener, webhook ou Stripe nessa subetapa.
2. Confirmar relógio/NTP e metadata/SSO atuais. Usar executor seguro e uma aquisição em memória, validar assinatura/claims e GET do JSON esperado.
3. Validar refresh controlado por invalidação explícita do cache, sem mudar relógio ou exp do token real; uma segunda aquisição prevista e validada. A Vercel pode devolver token válido idêntico, portanto não exigir string diferente como evidência de emissão.
4. Verificar invalidação por resposta sintética 401/403, obtenção serializada e cancelamento; somente um GET real adicional previsto, nunca retry automático do payload.
5. Para expiração natural Development (12 h), definir sessão supervisionada e autorização independente, com janela de exp real e número máximo de aquisições/GETs. Não esperar horas automaticamente, forjar exp ou chamar teste simulado de expiração real.
6. Encerrar, confirmar processos/portas fechados e buffer/referências limpos. Publicar somente booleans/code/durações, sem tokens/cookies/claims privados.

O padrão do manager é on-demand: reuse acima de 60 s restantes, refresh abaixo desse limite, valida novo token com margem 30 s, obtém uma vez para chamadas concorrentes e não usa stale token após falha. Não é um agendamento de refresh garantido; ao falhar, fecha o envio. Referência de self-access OIDC: [Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources).

## Plano de publicação e Preview — não executado

1. Autorizar e implementar primeiro os bloqueadores operacionais, com testes adicionais e manifesto final revisado. Manter real-start bloqueado por padrão. Não instalar secrets ou habilitar gates como parte do patch.
2. Após autorização de publicação, conferir origin/repositório/branch, HEAD remoto esperado, draft/base da PR #60 e ausência de merge. Divergência => parar, sem force/rebase automático.
3. Rever o diff integral, hashes e secrets do manifesto; staging explícito dos arquivos aprovados; excluir operadores/evidências/untracked antigos. Conferir diff staged, sintaxe, suíte serial e reprodução convertida em regressão que exija encerramento correto.
4. Criar um único commit e push somente à branch #60, sem force, preservando git.deploymentEnabled=false. Confirmar PR draft/base e nenhuma mudança main/Production; comparar histórico de deployments em leitura antes/depois sob autorização.
5. **Deploy não é necessário para executar testes de ferramentas locais.** Se quiser atualizar o Preview, solicitar autorização separada para um único deployment manual Git-source no novo SHA, mantendo 21 variáveis/gates/SSO, sem arquivos locais. Conferir recibo/histórico antes de retry em timeout; nenhum retry automático.
6. Se houver novo deployment, registrar ID/SHA/URL individual e obter autorização explícita para a nova entrada local do catálogo. Alias movement deve bloquear o antigo launcher. Não presumir que publicação de nova ferramenta autoriza novo alvo ou sessão Stripe.
7. Preflight GET do novo alvo exige autorização específica; manter Checkout/webhook/marketplace desativados. Não atualizar secrets/flags automaticamente para conseguir HTTP 200.

## Plano progressivo de teste Stripe sem dinheiro real — não executado

- **A — local:** mocks/loopback/PostgreSQL descartável, replays, eventos fora de ordem, assinatura inválida, concorrência, preços/carteira e estados de refund; já cobertos e a repetir após correções.
- **B — identidade/execução:** autorização de leituras Stripe/Vercel, confirmar CLI/conta test e executor/refresh/cleanup. Sem sessões, listener, gate ou eventos de escrita.
- **C — listener supervisionado:** autorização específica para conexão real @self test e captura whsec privada; não disparar eventos/trigger, não cadastrar endpoint externo e não encaminhar automaticamente ao Preview. Instrumentar filas/erros com dados sanitizados. Configuração do secret/gate branch-only e eventual deployment precisam de aprovações próprias.
- **D — smoke do transporte:** aprovar um payload sintético explicitamente identificado, sem ordem financeira, validando assinatura/raw bytes/OIDC e isolamento de rotas. Pode-se usar evento não tratado, que é ignorado após GET da identidade da conta; isso não comprova entrega de evento criado pela Stripe nem confirma um pagamento. Autorizar o POST e suas consultas de leitura separadamente. Não marcar um envelope sintético como pagamento real da Sandbox.
- **E — Checkout Sandbox:** após infraestrutura aceita e autorização comercial/teste específico, criar apenas pedidos fictícios e sessão test, usar cartão de teste documentado em [Stripe testing](https://docs.stripe.com/testing), nunca cartão real. Habilitar Checkout/marketplace somente com aprovação explícita branch-only. Não há movimento bancário real em modo teste, mas há criação de objetos Stripe e escritas financeiras simuladas no Development, que exigem autorização.
- **F — confirmação:** receber completed/async/expired em Sandbox, verificar conta/session/amount/state e RPCs. Replay autorizado não duplica order/purchase/events. Card-only não comprova métodos assíncronos reais: mantê-los simulados ou pedir novo escopo antes de adicionar métodos.
- **G — reconciliação:** autorizar registros sintéticos/observações e, separadamente, eventual refund test. Comprovar pending/failure/network/late payment, buyer limit, refund_required e confirmação processor succeeded. Não registrar estorno concluído por mero pedido; nenhum refund live.

Não executar stripe trigger genericamente: ele pode criar objetos de teste na conta e não garante metadata/order compatíveis com o app. Não utilizar dados operacionais ou oferecer liberação de contatos na etapa preparatória.

## Critérios para avançar

- Bloqueadores do executor/cleanup/deadlines resolvidos e testes de regressão aprovados.
- Manifesto seguro publicado somente após autorização; nenhum segredo ou arquivo privado incluído; nenhum deployment automático.
- Identidade do deployment/account e sincronização do relógio verificadas sob escopo autorizado.
- Renovação/encerramento reais comprovados com orçamento controlado, sem claims/tokens registrados.
- Dupla autenticação OIDC + Stripe-Signature e fail-closed demonstradas, SSO preservado para demais rotas.
- Schema/RLS/grants e ausencia de operações pendentes no Development auditados em leitura antes de qualquer teste que escreva; autorização de mutação sintética explícita.
- Preflight é configuração, não autorização financeira. Gates negativos e testes de bloqueio live/produção passam.
- Autorizações separadas para listener, whsec/configuração, POST/eventos, Checkout e qualquer conciliação/refund. Nenhum preço definitivo ou contato real.

## Testes e auditoria

Suíte completa serial executada nesta auditoria: **269 aprovados, zero falhas/skips/cancelamentos**, 101,2 segundos. Inclui identificação do deployment, 46 códigos OIDC, renovação simulada, payload/assinatura, HTTP de handlers com Stripe mock e SQL nativo descartável com sessões concorrentes, duplicidade, limites e estornos confirmados. Evidência ignorada `test-output/stage100-full-serial.txt`.

A reprodução negativa do cleanup confirmou o risco descrito, não é sinal de prontidão operacional. Testes simulados não provam listener real, assinatura CLI hospedada ou pagamento Sandbox.

Auditoria concluída: **12 arquivos no manifesto, 19 arquivos de evidências anteriores revisados, 16 JavaScript/CJS com sintaxe válida, zero candidatos a credenciais reais**, seis matches explicitamente sintéticos. SHA-256 dos 12 arquivos registrado no recibo ignorado `test-output/stage100-publication-audit.json`. Origin corresponde ao repositório esperado; branch/HEAD preservados, staging vazio, escopo de alterações tracked válido e git.deploymentEnabled=false. Diff sem erros de whitespace; avisos LF/CRLF são da configuração Windows. A varredura de padrões não constitui prova matemática de ausência de todo tipo de segredo; o manifesto também foi revisado manualmente e exclui artefatos privados. Nenhuma dependência foi instalada/alterada. Registros reais de 9.5 foram lidos somente sanitizados; tokens/cookies não existem nesses recibos.

**Encerramento da 10.0:** somente relatório/plano, sem correções de código, novas credenciais ou acesso autenticado adicional. Aguardar autorização específica para implementar/publicar os bloqueadores ou executar qualquer próxima operação remota. Stripe permanece bloqueado.

## Continuação 10.1

As correções locais autorizadas de cleanup/ownership, prazos, OIDC e primitivas nativas estão registradas em [stripe-stage101-operational-fixes.md](stripe-stage101-operational-fixes.md). O manifesto cumulativo proposto passa a 16 arquivos. Os achados e hashes da 10.0 permanecem evidência histórica; nenhum listener real ou publicação foi autorizado por essa atualização.
