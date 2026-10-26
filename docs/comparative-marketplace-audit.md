# Auditoria comparativa — GetEstimateFast

Data: 2026-10-09. Auditoria de código e metadados, sem acesso a registros pessoais ou financeiros.

## Fontes verificadas

- Referência localizada pelo GitHub conectado: [cosaqdigital/orcamento-brasil](https://github.com/cosaqdigital/orcamento-brasil), commit `d4a5805d7b608186fbac98c4c9117fdfa3ca99ab`.
- Destino: [cosaqdigital/getestimatefast-v2](https://github.com/cosaqdigital/getestimatefast-v2), commit `dd8252febcae2573a7c1a578c5ef998944524d3e`, head da PR #49.
- PR [#47](https://github.com/cosaqdigital/getestimatefast-v2/pull/47): simulação SMS e consentimento; [#48](https://github.com/cosaqdigital/getestimatefast-v2/pull/48): preparação Zenvia; [#49](https://github.com/cosaqdigital/getestimatefast-v2/pull/49): webhook STOP/HELP. Todas abertas; #49 inclui #48 e #47 por ancestralidade. Nenhuma foi mesclada neste trabalho.
- Supabase referência `ecbcbvnupndkaypegubv`: apenas inventário de tabelas. Supabase destino `wedsjubkttygxtpkopfj`: nome confirmado `getestimatefast-prod`, PostgreSQL 17; estrutura e políticas consultadas em modo somente leitura.
- [Site público da referência](https://orcamentobrasil.com): solicitação gratuita, escolha independente e disponibilidade regional. O site americano não foi acessível pelo leitor web nesta auditoria.
- Vercel: time confirmado `get-estimate-fast`; consulta pelo nome e ID retornou 404 e listagem filtrada vazia. Comentários das PRs registram previews READY, mas isso não comprova acessibilidade atual nem testes ponta a ponta.
- A pasta HTML original local é antiga e não contém o backend atual. Foi preservada. Desenvolvimento em checkout separado `getestimatefast-development` e branch `feat/us-marketplace-wallet-foundation-20261009`.

## Matriz comparativa

| Mecanismo | Orçamentos Brasil: evidência no código | GetEstimateFast em #49 | Decisão e prioridade |
|---|---|---|---|
| Captação e revisão | API leads, qualificação e confirmação comercial | API lead, revisão administrativa e reconfirmação de legado | Preservar fluxo americano; P0 |
| Publicação sem PII | Resumo público separado de contatos privados | opportunity_previews e RPC sanitizada | Reutilizar separação, manter aprovação manual; P0 |
| Matching | Categorias, cidades e raio com centroides municipais | Categorias existentes, ZIP FL e raio em milhas | Preservar biblioteca florida-matching e regra Other Services; P0 |
| SMS | Ciclos de avisos, retries e idempotência | Simulação, opt-in e STOP/HELP preparados | Manter dry-run; limite de 5 destinatários por rodada não é limite de compradores; P0 |
| Dashboard | Navegação para perfil, carteira, contatos e oportunidades | Login, perfil e cards básicos | Acrescentar resumo e navegação, reutilizando autenticação; P1 |
| Preço canônico | lead-pricing.ts classifica porte P/M/G/E por escopo/categoria; 15/24/35/55 créditos piloto | Não há preço nem compra no inventário atual | Regras USD por categoria/escopo/urgência, sem seed de preços comerciais; P1 |
| Desconto temporal | commercial-state.ts e SQL: 10% ao dia até 40%, expiração em 5 dias | Ausente | Reaproveitar cálculo temporal, tornar agenda e expiração configuráveis; P1 |
| Compradores | Ciclo comercial bloqueia após 3 liberações ativas | Apenas destinatários de matching | Limite comercial configurável separado de notificações; P1 |
| Ajuste de preço | admin_set_opportunity_contact_price, motivo e auditoria, antes da publicação | Ausente | Revisões imutáveis e preço congelado na cotação; P1 |
| Ledger e débito | wallet_transactions, lock da carteira, débito/liberação atômicos e chave idempotente | Ausente | Novo ledger USD com paid/promotional/refund separados; P1 |
| Recarga | Mercado Pago, PENDING/CONFIRMED, webhook e crédito automático | Ausente | Contrato de processador americano, sem checkout ou confirmação real; P2 |
| Promoção | TOPUP_LAUNCH_2026 e 3 pacotes fixos BRL; bônus vinculado ao crédito | Ausente | Agenda/valores configuráveis; sempre permitir complemento exato sem bônus; P2 |
| Estorno | Denúncia, análise admin e refund_transaction_id | Ausente | Reversão auditada, valor limitado ao débito original e revogação do acesso; P2 |
| Perfil público | Slug, apresentação, serviços, regiões e portfólio | Apenas perfil privado | Perfil gratuito e consentimento explícito para contatos; P2 |
| Avaliação | Hash de identidade, verificação por token, moderação e denúncias | Ausente | Convites exclusivos, origem externa/plataforma e publicação moderada; P2 |
| Serviço de perfil | professional_profile_service_orders separado da carteira | Ausente | Preço USD configurável; pedido separado, pagamento bloqueado; P2 |
| Divulgação | Link, WhatsApp, compartilhamento nativo e QR | Ausente | Link, WhatsApp, SMS, e-mail, Facebook, nativo e Open Graph; P2 |
| Administração | Auditoria, carteiras, preço, moderação e operação comercial | Leads, profissionais, status, publicação e simulação | Expandir mantendo fluxo atual; P2 |

## Análise comercial e técnica

Fatos: a referência contém uma arquitetura Next.js/TypeScript com Supabase; o destino usa HTML/JavaScript e funções Node na Vercel. Copiar componentes TSX exigiria reconstruir o stack sem necessidade. Reutilizar contratos, estados e invariantes oferece menor risco.

Precificação: categorias afetam classificação pelo escopo (área, cômodos, pontos, complexidade). Urgência participa da prontidão comercial; o código consultado não comprova um multiplicador universal de urgência. Não presumir que ele exista. Override administrativo exige validação e motivo. Desconto temporal deriva da publicação e não do número de profissionais notificados.

Carteira: a referência calcula saldo pelo ledger e serializa operações com locks; pagamento pendente não equivale a crédito. Promoções adicionam crédito separado após confirmação. A adaptação deve melhorar a separação de origens: dinheiro pago, bônus e estornos não podem ser tratados como uma única entrada indistinta. Refund interno não é devolução ao cartão; futura devolução no processador é outro fluxo.

Avaliações: o código da referência implementa verificação e moderação, mas existência de código/tabela não comprova uso operacional bem-sucedido. Origem vinculada à plataforma comprova a origem do contato, não conclusão, qualidade ou licença do serviço.

Potencial comercial (hipóteses para validar): perfil gratuito reduz fricção e incentiva divulgação; compra individual permite testar disposição a pagar; pacotes opcionais podem aumentar retenção; serviço de preparação de perfil gera receita independente. Não estimar conversão, receita ou preços sem dados americanos.

Não copiar: preços BRL, créditos piloto 15/24/35/55, Mercado Pago, CPF/CNPJ/CEP, critérios de municípios brasileiros, textos legais brasileiros, limite fixo de 3 compradores, packs de R$100/150/200 ou credenciais. Não importar usuários, contatos, saldos, pagamentos, fotos ou avaliações reais. Não alterar o repositório nem banco da referência.

## Plano priorizado e critérios

1. **P0 — preservação e segurança:** branch sobre #49; comparar ancestrais; testes SMS e matching; nenhuma escrita em produção/main.
2. **P1 — área profissional:** dashboard com contagem real das oportunidades permitidas, status, carteira e atividades; filtros de categoria/cidade/ZIP/raio; navegação acessível. Não apresentar saldo fictício como real.
3. **P1 — domínio financeiro:** regras sem preços padrão; cotações com versão e vencimento; ledger imutável, locks, idempotência e não negatividade; compra/refund apenas em testes locais. Testar corrida pela última vaga e duplicações.
4. **P2 — vitrine/reputação:** perfil gratuito com privacidade, portfólio, links, idiomas; convites de avaliação com tokens imprevisíveis, moderação e distinção de origem; divulgação e OG.
5. **P2 — operação:** preços/promos versionados, auditoria de ajustes, moderação e relatórios sem PII nos logs; serviço de perfil independente.
6. **P3 — integração futura:** somente depois de aprovação do modelo, escolher/adaptar Stripe e validar webhooks assinados, idempotência, chargebacks, moeda e confirmação server-side. Nenhuma cobrança real neste trabalho.

## Limites e validação

Pedido recebido integralmente após duas continuações, incluindo as seções 14–17 e autorização para branches próprias e PRs draft. Mudanças financeiras não serão aplicadas no Supabase identificado como produção. Nova arquitetura precisa de banco isolado antes de ativar APIs que dependam dela. Testes locais não equivalem a verificação de produção, SMS real ou aprovação comercial/jurídica.

Orientação técnica consultada: [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). Inventário atual do destino: todas as tabelas públicas com RLS habilitada, sem políticas públicas listadas; acesso mediado pelo backend service role. Cada novo endpoint precisa autorizar proprietário/admin no servidor e projetar explicitamente campos públicos.
