# Validação do Preview hospedado — preparação e bloqueios

Verificação: 2026-10-10 UTC. Base: PR draft #52, commit `8b0a33726e05cab503b636af23a54cfdb47a0da4`.
Branch de correções: `feat/hosted-preview-validation-20261010`.

**Endereço exato do Preview validado: nenhum. A validação hospedada permanece bloqueada por acesso/identidade do projeto Vercel.** Os testes locais e a auditoria SQL remota não substituem esse teste.

## Identidade e acesso Vercel

Identificadores fornecidos: projeto `getestimatefast-v2`, `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF`, time `team_vRw9eJBijmUFe1SbbOFY5xZs`.

- O conector lista esse time, com slug `get-estimate-fast`.
- Consultar o projeto pelo ID ou nome retorna **404**.
- Listar deployments pelo projeto/time retorna **403**, sem permissão.
- Buscar o projeto na lista desse time retorna lista vazia.
- O navegador disponível redireciona a página do projeto para login; não há sessão autenticada disponível.
- Não há CLI Vercel autenticada disponível. Nenhum token foi solicitado ou recuperado.

Esses resultados não comprovam exclusão do projeto; indicam que a conexão atual não permite confirmar sua identidade nem obter um Preview confiável. Nenhuma variável Vercel foi lida ou alterada, nenhum ambiente Production foi acessado e nenhum deployment foi criado por ferramenta Vercel nesta etapa. A publicação da branch pode disparar a integração Git existente; isso não comprova que o deployment pertence ao projeto informado.

## Supabase Development auditado

Projeto exclusivo: `getestimatefast-development`, ref `cpjsbijgijeyrwjpuciv`.

- Histórico com as 20 migrações instaladas; nenhuma reaplicada.
- Zero usuários Auth, leads e objetos Storage na consulta desta etapa; nenhuma fixture foi gravada remotamente.
- RLS ativo nas tabelas de aplicação; nenhum índice inválido.
- Nenhuma permissão de tabela de aplicação ou execução de função exposta a `anon`/`authenticated`; `gef_private` sem USAGE para esses papéis. O backend continua responsável pela autorização, usando suas credenciais somente no servidor.
- Bucket `gef-portfolio`: público para imagens consentidas, limite 3.000.000 bytes, JPEG/PNG/WebP. Não utilizar para documentos privados. Upload autenticado pela API ainda não foi validado remotamente.
- A consulta de configurações de schemas PostgREST não retornou configuração explícita; a exposição efetiva da Data API precisa ser verificada no fluxo hospedado.

Advisors executados novamente: segurança **0 WARN/ERROR**, 28 INFO de RLS sem policy, compatíveis com o desenho atual de acesso exclusivo pelo backend. Desempenho **0 WARN/ERROR**, 39 INFO: 6 FKs sem índice de cobertura, 32 índices ainda não utilizados e 1 configuração de conexões Auth. Não foram criados índices nem alteradas permissões nesta etapa. O relatório da instalação registra o estado anterior, com 33 índices ainda não utilizados.

## Correções e testes

O isolamento anterior cobria apenas a branch da PR #51. As branches da PR #52 e desta validação agora recusam backend herdado de produção e qualquer ref diferente do Development aprovado.

`GET /api/preview-readiness` verifica configuração antes de habilitar as APIs: branch, ambiente Preview, backend/ref, presença de variáveis, origem HTTPS, segredo de identidade de avaliações, SMS simulado e Stripe explicitamente desativado. Retorna apenas nomes de variáveis ausentes e erros, nunca seus valores. Não consulta o banco; sua resposta informa `database_integrity_verified=false`.

As APIs de marketplace exigem preflight válido antes de acessar Auth ou provedores. Cadastro público e envio de leads permanecem bloqueados nas branches protegidas para impedir e-mails externos, inclusive com flags/credenciais herdadas.

**`npm test`: 65 testes aprovados, 0 falhas.** Cobertura local inclui SQL, concorrência em sessões separadas, idempotência, saldo negativo, limites de compradores, estornos, separação de carteira/criação de perfil, avaliações/moderação, HTTP/DOM e Stripe simulado. Os novos testes verificam recusa do backend indevido, ausência de segredos na resposta, preflight antes de acesso externo e bloqueio de entregas.

| Área | Evidência desta etapa | Validação hospedada |
|---|---|---|
| Auth e permissões | Guards locais; SQL remoto sem acesso indevido de navegador | Pendente com usuários fictícios |
| Dashboard, oportunidades e precificação | Suíte local; schema remoto instalado | Pendente |
| Carteira e concorrência | PostgreSQL local, dados fictícios | Pendente; cobranças bloqueadas |
| Perfil público e avaliações | HTTP/DOM e moderação locais | Pendente |
| Portfólio e Storage | Configuração/RLS remotos e testes locais | Upload/leitura/remoção pendentes |
| Administração | Permissões SQL e testes locais | Sessão admin e negação a não-admin pendentes |
| Desktop/mobile | Nenhum resultado de navegador hospedado | Pendente |

## Fixtures preparadas, sem execução remota

`node scripts/hosted-preview-fixtures.js` produz um plano sem rede, credenciais ou SQL remoto. Contém três contas sintéticas, duas oportunidades, telefones fictícios, e-mails `example.invalid`, preços em centavos USD e consentimentos de teste. Não injeta saldo nem cria avaliações apresentadas como reais.

Criar contas somente por **Auth admin.createUser**, com `email_confirm=true`, utilizando credenciais Development configuradas de forma segura. Não usar signup/invite/generateLink, e não inserir diretamente em `auth.users`. Usar IDs retornados pelo Auth, manter o mapeamento privado e atribuir administração apenas à conta sintética de teste. Os campos/IDs do plano precisam ser adaptados aos contratos das RPCs existentes; ele não é um instalador.

## Sequência para desbloquear e validar

1. Corrigir o acesso da conexão ao projeto informado. Reconsultar projeto/time/ID antes de qualquer alteração de configuração.
2. Confirmar deployment **Preview**, branch desta PR e SHA exato. Registrar sua URL real e conferir proteção de acesso, logs sem segredos e ausência de redirecionamento para produção.
3. Configurar variáveis exclusivamente com target `preview` e gitBranch `feat/hosted-preview-validation-20261010`, usando `.env.preview.example`. Nunca copiar credenciais Production.
4. Configurar seguramente `GETESTIMATEFAST_SUPABASE_SECRET_KEY`, `GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY`, `GETESTIMATEFAST_REVIEW_IDENTITY_SECRET` e `GETESTIMATEFAST_PUBLIC_ORIGIN` com a origem Preview confirmada. Não publicar valores nem enviá-los no chat. Ref/URL devem apontar exclusivamente para `cpjsbijgijeyrwjpuciv`.
5. Manter `GETESTIMATEFAST_MARKETPLACE_PREVIEW=false`, SMS `dry_run`, Stripe mode `test`, aprovação Checkout `false`, signup e persistência pública de leads desativados. Secrets Stripe não são necessários para esta etapa.
6. Redeploy somente Preview. Exigir preflight HTTP 200/ready=true com marketplace desativado. Conferir separadamente Auth/Data API/Storage Development e integridade SQL; o preflight de configuração não prova conectividade.
7. Preparar contas fictícias via Auth admin e oportunidades pelos fluxos administrativos existentes. Nenhum SMS/e-mail externo. Registrar IDs somente em registro privado de execução.
8. Após as verificações anteriores, habilitar apenas `GETESTIMATEFAST_MARKETPLACE_PREVIEW=true` nessa branch e redeploy Preview. Conferir novamente preflight e SHA. Manter Checkout desativado.
9. Testar login/logout/expiração, respostas 401/403, dashboard, categorias e preços, privacidade do contato antes da compra, edição/publicação de perfil, link público, convites/avaliações externas e moderação, portfólio permitido/proibido e limites MIME/tamanho, administração negada a não-admin. Verificar a ausência de dados privados nas respostas e logs.
10. Testar desktop 1440×900 e mobile 390×844: navegação, teclado/foco, formulários, overflow, links públicos e ações de compartilhamento sem efetuar envio. Operações financeiras permanecem simuladas; não ativar endpoints de cobrança para testar infraestrutura.
11. Registrar URL/SHA e evidências por fluxo, remover fixtures identificadas ao terminar e executar Advisors novamente. Interromper ao encontrar acesso a backend errado, entrega externa, segredo exposto ou autorização incorreta.

Nenhuma alteração em main, Supabase de produção, Orçamentos Brasil ou Vercel Production. Nenhum merge, pagamento ou SMS/e-mail externo. Stripe Checkout permanece desativado.
