# GetEstimateFast — implementação e verificação

## Resultado

Branch `feat/us-marketplace-wallet-foundation-20261009`, baseada em `feat/zenvia-us-webhook-safety-20261009` / PR #49. A ancestralidade das PRs #47 e #48 foi confirmada com Git. Todo desenvolvimento pertence ao GetEstimateFast; referência brasileira consultada somente em leitura. Nenhum merge, escrita em main, envio SMS, pagamento real ou migração financeira em produção.

Entrega para revisão: [PR draft #50](https://github.com/cosaqdigital/getestimatefast-v2/pull/50), aberta e confirmada como draft com a base acima. Os checks Vercel e Vercel Preview Comments do commit de implementação passaram; isso confirma o status de deploy informado pelo GitHub, sem validar visualmente o produto nem provisionar o backend isolado.

Comparação, evidências, decisões comerciais e prioridades: [auditoria comparativa](comparative-marketplace-audit.md).

## Implementado

| Módulo | Comportamento entregue | Disponibilidade |
|---|---|---|
| Dashboard | Contagem de oportunidades conforme filtros, status do perfil, saldo real do backend isolado, compras, histórico e atalhos | HTML + APIs locais; novas APIs bloqueadas por padrão |
| Oportunidades | Cidade, categoria, ZIP e raio; filtro de expiradas; preços configurados; projeção explícita sem contatos | Mantém matching original e nunca amplia cobertura autorizada |
| Precificação | Centavos inteiros; categorias existentes; multiplicadores por escopo/urgência; desconto temporal crescente, piso, prazo e limite de compradores configuráveis | Sem preços comerciais seedados; termos congelados por publicação |
| Carteira | Ledger imutável paid/promotional/refund; locks; não negatividade; limite técnico de saldo; débito e aquisição na mesma transação; estorno auditado | SQL local testado; rotas financeiras sempre bloqueadas |
| Recargas e bônus | Pendência fora do saldo; contrato de confirmação exclusivamente test-mode; valor/moeda/evento idempotentes; bônus separado; complemento exato disponível no domínio | Não há checkout nem webhook financeiro ativo |
| Perfil gratuito | Apresentação comercial, categorias, localização/milhas, idiomas, links sociais, privacidade e portfólio | Backend isolado; upload mediado e bucket preparado |
| Avaliações | Convite aleatório por cliente, expiração e uso único; identidade por HMAC; origem externa ou contato da plataforma; moderação, denúncia e limite persistente de submissão | Envio manual; nenhuma mensagem automática; origem não comprova conclusão de serviço |
| Serviço de perfil | Preço configurável separado; self-service gratuito; intenção de pagamento com propósito próprio | Cotação informativa; checkout bloqueado |
| Divulgação | Link copiado, WhatsApp, Facebook, SMS, e-mail, compartilhamento nativo e Open Graph renderizado no servidor | Ações manuais no dispositivo do usuário |
| Administração | Revisões imutáveis de preços/promos, termos por oportunidade, preço do serviço de perfil, avaliações/denúncias, auditoria e indicadores | Novo painel; mantém revisão, publicação e distribuição existentes |
| Stripe futuro | Preparação pura de Checkout com centavos, moeda USD, metadata e chave idempotente | Sem SDK, credenciais, chamadas externas ou autorização para live mode |

A interface continua indicando que GetEstimateFast conecta profissionais independentes; não certifica licenças nem garante serviços. O slogan permanece “We Connect. You Decide.”.

## SQL preparado

O repositório existente usa scripts em `sql/`; foram mantidos esse padrão e os nomes descritivos. Não foram registrados como migrações aplicadas no Supabase.

Ordem para **um backend GetEstimateFast isolado**, após instalar o schema existente correspondente à #49:

1. `sql/us_marketplace_financial_foundation.sql` — regras, promoções, termos/cotações, ledger, compras, ajustes/estornos internos e auditoria.
2. `sql/us_public_profiles_reviews.sql` — perfis, convites, avaliações, denúncias e preço do serviço independente.
3. `sql/us_marketplace_read_models.sql` — projeções públicas/privadas e configuração administrativa.
4. `sql/us_topup_test_contract.sql` — confirmação apenas de pagamentos sintéticos `stripe_test`; live mode rejeitado.
5. `sql/us_public_review_rate_limit.sql` — limites persistentes com hashes de endereço de cliente.
6. `sql/us_portfolio_storage.sql` — bucket Supabase específico, sem permissões de escrita direta para navegador.

RLS em todas as novas tabelas. Schema `gef_private` sem acesso público. Funções SECURITY INVOKER, search_path vazio e EXECUTE revogado de PUBLIC/anon/authenticated. APIs autenticam proprietário/admin antes de chamar RPCs. Ledger, termos, cotações, eventos financeiros e revisões de configuração são imutáveis; correções financeiras usam entradas compensatórias.

## Ambiente e demonstração local

`npm ci --ignore-scripts`, `npm test`, depois `node scripts/local-marketplace-sandbox.js 4173`.

O sandbox cria PostgreSQL embarcado em memória e dados marcados como sintéticos. Não baixa dados de nenhuma plataforma e não utiliza credenciais reais. Contas de teste exclusivas do sandbox: `contractor@example.invalid` e `admin@example.invalid`, senha `SyntheticTestOnly!`. Essas strings não são credenciais de produção.

Rotas locais: `/contractor-portal.html`, `/marketplace-admin.html`, `/professionals/<slug>` e `/review.html#<convite>`. O convite fica no fragmento, é removido da barra de endereço após carregamento e só é enviado na submissão. Não usar senhas sintéticas em um backend real.

Para um Supabase de desenvolvimento, usar credenciais próprias desse novo projeto, com variáveis escopadas à branch Preview:

- `GETESTIMATEFAST_ISOLATED_BACKEND=true`
- `GETESTIMATEFAST_MARKETPLACE_PREVIEW=true`
- `GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF=<ref exclusiva de desenvolvimento>`
- `GETESTIMATEFAST_SUPABASE_URL`, `GETESTIMATEFAST_SUPABASE_SECRET_KEY`, `GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY` desse projeto.
- `GETESTIMATEFAST_PUBLIC_ORIGIN=<origem HTTPS confiável do preview>`
- `GETESTIMATEFAST_REVIEW_IDENTITY_SECRET=<segredo independente, mínimo 32 caracteres>`

O modo isolado rejeita VERCEL_ENV=production e os refs conhecidos de produção, Orçamentos Brasil e Pelos e Patas. Usar somente dados sintéticos no desenvolvimento. Sem modo isolado, a configuração original do backend americano continua fixada no ref existente, mas as novas APIs permanecem bloqueadas. Não configurar essas flags ou chaves no ambiente Production.

Manter `GETESTIMATEFAST_SMS_MODE=dry_run` e as travas Zenvia existentes. O cadastro/edição privado original continua obedecendo às flags existentes. A edição pública não altera aprovação de conta, categorias de matching ou preferência SMS.

## Evidências e limites

- Validação final: `npm test` passou com **44 testes, zero falhas**, incluindo execução das funções financeiras com os grants reais de `service_role`. `git diff --check` passou.
- `npm audit --omit=dev`: zero vulnerabilidades nas dependências de produção.
- Testes Node cobrem centavos, arredondamento, descontos, prazo, compradores, filtros e consentimento.
- PostgreSQL PGlite executa o SQL preparado e verifica rollback atômico, duplicação de compras/eventos, estorno, separação de saldos e privilégios/RLS.
- Testes HTTP executam handlers reais com Auth e PostgREST substituídos exclusivamente no sandbox, e RPCs em PostgreSQL real embarcado. Confirmam autorização, perfil, moderação, preço e bloqueio financeiro sem entradas de ledger.
- Testes DOM executam os scripts da interface em um DOM de teste. Não são evidência visual de navegador real.
- O navegador do Codex falhou com `Timed out waiting for the Browser webview to attach for this browser-use page`; inspeção visual desktop/mobile permanece pendente.
- PGlite tem uma conexão; tentativas concorrentes são enfileiradas. Locks e limite comercial foram exercitados, mas corrida entre sessões PostgreSQL independentes exige teste adicional no backend isolado completo.
- Bucket/Storage real, verificação de identidade por e-mail, moderação operacional e advisors Supabase do novo ambiente ainda precisam validação. O upload local usa objetos em memória; assinatura/limite/tipo do arquivo foram preparados no handler, mas não há transcodificação/remoção de EXIF nem análise automática de conteúdo.
- Vercel conectado retorna 404/listagem vazia para o projeto; não há alegação de preview hospedado verificado. GitHub pode criar um preview automaticamente ao publicar a branch, sem comprovar prontidão das novas APIs.

## Pendências e próximos passos

1. Provisionar um Supabase exclusivo de desenvolvimento, instalar o schema base e os seis scripts preparados, executar advisors e validar grants usando service_role.
2. Vincular esse backend ao Preview da nova branch e conferir visualmente desktop/mobile, Storage e compartilhamentos nos dispositivos.
3. Validar preços americanos, limite comercial de compradores, características/urgências e política de descontos; não reaproveitar os valores brasileiros. Definir política de estorno e aprovação do modelo comercial.
4. Antes de qualquer cobrança futura: integração Stripe assinada e test-mode, confirmação server-side, chargebacks, políticas de bônus/estorno e testes multi-sessão. O contrato atual rejeita live mode e não oferece endpoint de cobrança.
5. Antes de aquisição real: implementar a criação confiável de cotações e revalidar matching/consentimento na compra; a arquitetura SQL já consome cotação do servidor, mas a API de aquisição e a liberação de contatos seguem bloqueadas.
6. Revalidar e implementar envio financeiro do serviço de perfil em pipeline separado da carteira. A configuração/cotação já existe; pagamento e execução comercial são futuros.
7. Resolver os requisitos externos da Zenvia listados na PR #49; não habilitar SMS neste trabalho.

Documentação técnica consultada: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create) e [locks PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS).
