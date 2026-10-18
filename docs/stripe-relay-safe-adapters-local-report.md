# Etapa 5 — adaptadores seguros Vercel/Stripe, somente locais

Base: `feat/stripe-sandbox-safety-20261012`, HEAD preservado `9901db8b8e99ae510de9e3f63b61c6e39256befa`. O trabalho local da etapa 4 foi preservado. Nenhuma configuração, autenticação, token novo, segredo real, deployment ou publicação foi executado. Nenhum evento foi enviado ao Preview.

## O que está implementado

`scripts/stripe-relay-adapters.js` fornece planos estruturados de comandos e adaptadores de processo/API/JWKS testáveis. Somente modo sintético é permitido. Não importa um executor nativo nem fornece transporte de rede real por padrão: a ausência de mocks ou a escolha de modo real recusa a execução.

Os comandos futuros Stripe usam caminho absoluto de stripe.exe e argv separado. Vercel usa node.exe e o entrypoint JS da CLI revisada, evitando npx.cmd, PowerShell, cmd.exe e interpolação de URLs. Os binários/entrypoints deverão ser conferidos antes de autorizar um executor real; esta etapa não determina nem instala automaticamente esses caminhos.

Foi inspecionado apenas o código instalado da CLI Vercel 63.1.2 (sem autenticar/executar comandos operacionais). `env run` chama pullEnvRecords para o target escolhido e mescla records.env com arquivos locais carregados por loadEnvConfig e process.env, que têm prioridade sobre os registros remotos. O plano exige cwd absoluto operacional separado do checkout; o runner recusa qualquer arquivo .env/.env.* nesse diretório e remove overrides do ambiente. Isso foi testado com um arquivo estritamente sintético. O entrypoint JS 63.1.2 foi localizado no cache já instalado, sem instalação adicional; o futuro executor deverá revisar seu caminho/hash, e a existência local não autoriza sua execução autenticada.

O executor privado mantém stdout/stderr em pipes e nunca herda o console. Limita saída e duração; descarta stderr e sanitiza exceções. Limpa buffers próprios e encerra somente filhos de sua propriedade. Terminações concorrentes são serializadas. O ambiente filho usa lista restrita de variáveis de sistema: não herda STRIPE_API_KEY, VERCEL_TOKEN, NODE_OPTIONS ou secrets do aplicativo. Falha de encerramento não remove a propriedade do processo e bloqueia recuperação que poderia duplicar o listener.

A seleção da Sandbox é um plano explícito `stripe switch acct_1UOl9qH5rFe1usWF --format json`, preparado conforme o help instalado, mas nunca executado. Não há switch automático após divergência. Antes de preparar listener, a leitura futura de versão/whoami deve comprovar CLI 1.53.1, conta exata e apenas modo test. Outra conta, autorização live ou identidade ambígua recusa início. A propriedade é reservada antes de operações assíncronas, bloqueando dois starts concorrentes. Os argumentos de listen devem corresponder exatamente ao plano aprovado: quatro eventos, @self, endpoint loopback, sem headers, api-key, live ou webhooks registrados.

O relay da etapa 4 preserva bytes/assinatura e descarta cookies/Authorization do cliente. A etapa 5 acrescenta invalidação do token em 401/403/redirect. A requisição atual falha de forma sanitizada; somente uma requisição posterior pode obter novo token. Não há retry automático de payload nem criação de listener adicional.

## OIDC considerado compatível e evidência oficial

A documentação atual [Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources) documenta `x-vercel-trusted-oidc-idp-token`, validação de assinatura/claims/regra de ambiente e self-access Development → Preview por padrão. Esse mecanismo preserva SSO para outros visitantes. Regras personalizadas podem remover esse acesso: a aceitação pelo projeto getestimatefast-v2 não pode ser reconfirmada nesta etapa sem leituras autenticadas/teste hospedado, que não foram autorizados.

Não se usa token de login/PAT da CLI como se fosse OIDC. O plano é capturar somente VERCEL_OIDC_TOKEN do filho de `vercel env run --environment development --project <projeto> --scope <time>`, usando a sessão oficial existente após aprovação. Não executado. [OIDC](https://vercel.com/docs/oidc) documenta tokens locais do projeto; [CLI env](https://vercel.com/docs/cli/env) documenta env run. Esse mecanismo injeta outras variáveis Development no filho: nunca imprimir o ambiente, nunca usar Production/Preview geral e revisar o escopo antes da futura autorização. Não usar env pull/arquivo .env para transportar o token.

O token capturado entra no validador da etapa 4: assinatura RS256, issuer global/team permitido, audience get-estimate-fast, subject, owner_id/team, project_id, project name, environment development/preview e iat/nbf/exp, incluindo rechecagem após obtenção de JWK. O manager renova antes de expirar, serializa obtenções e recusa ausência, expiração, adulteração e fonte não comprovada. JWT apenas decodificado não é aceito.

O adaptador JWKS prepara discovery do issuer fixado conforme [referência OIDC](https://vercel.com/docs/oidc/reference). Confere issuer e jwks_uri oficial em oidc.vercel.com, sem credenciais, query, redirecionamentos ou URLs do header do token. Impõe limite de 64 KiB e timeout; dados inválidos não autorizam encaminhamento. Todos os documentos/chaves desse adaptador nos testes são sintéticos; nenhuma chave ou token real foi obtido.

## Arquivos desta etapa

Criados:
- `scripts/stripe-relay-adapters.js`
- `tests/stripe-relay-adapters.test.js`
- `tests/local-postgres-lifecycle.test.js`
- Este relatório.

Modificados incrementalmente:
- `scripts/stripe-preview-relay.js`: callback de invalidação OIDC em rejeição/redirect.
- `scripts/stripe-preview-launcher.js`: invalidação e ligação ao relay.
- `tests/stripe-relay-launcher.test.js`: rejeição seguida de renovação, sem duplicar listener.
- `scripts/local-postgres.js`: prontidão SQL alternativa, conexão e início limitados, diagnósticos sanitizados de fases e limpeza após falha.

`tests/stripe-safety.test.js` e demais artefatos da etapa 4 continuam preservados. APIs hospedadas, schema, migrações, regras financeiras, gates, package.json/lockfile e vercel.json não foram modificados.

## Investigação PostgreSQL

A evidência anterior contém um teste falhando perto de 30 segundos, mas não contém a fase ou erro nativo original. Portanto não é possível atribuir definitivamente o timeout à concorrência ou a uma porta específica.

Auditoria da dependência embedded-postgres 17.10.0-beta.17: start reconhece prontidão pela presença de uma frase inglesa em um chunk de stderr. Uma frase dividida entre chunks pode não ser reconhecida. O helper anterior só encerrava o cluster se start já tivesse resolvido, deixando uma lacuna de limpeza em falhas/paradas durante o início. A escolha de porta fecha uma reserva temporária antes do bind PostgreSQL, criando uma pequena janela de corrida.

Correções locais, sem aumentar limites: autenticação da prontidão por SELECT 1 no loopback com credencial efêmera própria, mesmo sem marcador de stderr; deadline de início de 20 segundos; conexão de probe de 300 ms e conexão normal limitada a 5 segundos; fechamento de probes/clientes e processo próprio após falha. Antes de stop, que pode remover o diretório descartável, verifica-se que ele está dentro de test-output e tem nome pg-UUID. Nenhum banco remoto ou serviço é aceito pelo helper.

Ensaio paralelo controlado de dois clusters vazios: ambos inicializaram, responderam SELECT 1 e encerraram. Primeiro ensaio: initdb consumiu aproximadamente 21,5 segundos, start cerca de 0,5–0,7 segundo e close cerca de 1 segundo. O custo observado concentra-se na inicialização; isso torna carga/I/O local uma hipótese mais plausível que prontidão do servidor, mas não identifica CPU, OneDrive ou antivírus como causas comprovadas. Não houve colisão de portas observada. O teste inclui diagnósticos por fase sem senha, payload ou URL privada.

A serialização da suíte é recomendada para esta máquina e não substitui os testes explícitos de concorrência financeira com conexões independentes. Nenhum teste foi removido, ignorado ou convertido em sucesso artificial; não foram aumentados timeouts.

## Testes e resultados

- Primeira rodada focada, incluindo lifecycle/ensaio de dois PostgreSQLs: 57 aprovados, zero falhas/ignorados.
- Rodada focada após bloqueio de .env: **58 aprovados, zero falhas/ignorados**. No fechamento foi acrescentada sanitização da falha de término de processo, preservando propriedade para limpeza explícita; esse último caminho foi revalidado na rodada focada final de **59 testes**.
- Suíte completa serial: **151 aprovados, zero falhas, zero ignorados/cancelados**, em 161,2 segundos, após a correção de herança .env. Inclui instalação/migrações em PostgreSQL descartável, concorrência financeira, dois clusters paralelos controlados e todo o trabalho da etapa 4. A alteração final de mensagem de erro/ownership foi coberta pelos focados sem repetir novamente os testes PostgreSQL.
- Evidências: `test-output/stripe-stage5-focused-tests.txt`, `test-output/stripe-stage5-focused-final-tests.txt`, `test-output/stripe-stage5-full-serial-tests.txt`, `test-output/postgres-phase5-startup-diagnostics.json`.

Cobertura nova: comandos sem shell, conta/mode live errados, estado exclusivo de listener, dois starts concorrentes, término concorrente, captura privada/limites/timeout, remoção de overrides, ruído na saída OIDC, fontes/JWKS incorretos, respostas 302/401/403/503, destino externo, body grande, token rejeitado/renovado e prontidão SQL/encerramento. Os casos de assinatura, payload, portas loopback, cookies, destino/branch/Production, expiração e timeout continuam nos testes da etapa 4.

## Bloqueios, riscos e checklist futuro

1. Revisar o diff local completo e os resultados, sem descartar a etapa 4. Publicação exige aprovação distinta; nada foi commitado ou enviado.
2. Autorizar separadamente executores reais com caminhos/versões revisados, leituras de identidade e obtenção OIDC. O adaptador atual recusa modo real; não basta trocar um flag sem revisão de código.
3. Com autorização, confirmar Secure Backend Access/OIDC e regra self Development → Preview do projeto. Se ausentes, registrar bloqueio e solicitar configuração específica; não ampliar para Production nem desativar SSO.
4. Confirmar issuer/audience/claims reais e distribuição JWKS por leitura autorizada. Formatos incompatíveis falham fechados, sem ignorar validação para fazê-los funcionar.
5. Autorizar seleção exclusiva da Sandbox/listener e captura do whsec em memória. Nenhum endpoint Stripe cadastrado, webhook financeiro ou pagamento está autorizado por esta preparação.
6. Revisar encerramento real no Windows e revalidar whoami imediatamente antes de listen. O lock de processo é local ao adaptador; a sessão Stripe global poderia ser alterada por outro terminal. Durante o futuro listener, isolar a sessão operacional e interromper em divergência; não se afirma garantia criptográfica de conta apenas por whoami anterior.
7. Autorizar instalação do whsec/gate/deployment em etapa própria. Checkout/marketplace permanecem desativados. Teste hospedado deve começar com payload sintético controlado, sem operação financeira.

Buffers são zerados e referências descartadas, mas strings e bibliotecas JavaScript podem manter cópias internas até garbage collection; não se promete zeroização física completa. Tokens não devem entrar em traces/dumps/transcrições. Adaptadores reais de encerramento precisam confirmar término antes de permitir outro listener; mocks não provam comportamento real do sistema operacional ou rede.

Conclusão: adaptadores e mecanismos de segurança estão preparados e testados localmente. Compatibilidade documental não equivale a autenticação funcional no projeto. Nenhuma conta real, token real, whsec real, Stripe listen, evento hospedado, pagamento, variável, banco, deploy, PR, commit, push ou merge foi executado nesta etapa.

## Etapa 6 — revisão para publicação na PR #60

A autorização posterior permite um único commit/push das correções das etapas 4 e 5, na mesma branch, sem deployment ou execução real. As seções anteriores são registros históricos dessas etapas e não afirmações de que o código permanece sem publicação após essa autorização.

Pré-publicação: origin `cosaqdigital/getestimatefast-v2`, branch e HEAD remoto `9901db8b8e99ae510de9e3f63b61c6e39256befa` conferidos; PR aberta/draft, base `feat/review-already-submitted-20261012`; histórico Vercel com exatamente dois deployments. Não há workflows de deployment no repositório nem hooks Git locais ativos. `git.deploymentEnabled=false` permanece no arquivo original, sem diff.

Foram revisados integralmente os dez arquivos das etapas 4/5: quatro scripts, quatro testes e dois documentos. Nenhum script temporário operacional, log, test-output, .env, .vercel, configuração Auth ou outro documento local integra a seleção. O scanner encontrou somente seis valores intencionalmente sintéticos nos testes, zero candidatos a credencial real e zero JWT/PEM privados estáticos. Tokens e assinatura são gerados sinteticamente em memória. A revisão não converte os mocks em comprovação de autenticação hospedada.

Validação de publicação: **62 testes focados aprovados**, incluindo lifecycle e dois PostgreSQLs descartáveis; **152 testes na suíte completa serial aprovados**, zero falhas, cancelados ou ignorados, em aproximadamente 145 segundos. Oito arquivos JavaScript passaram na verificação de sintaxe; diff sem erros de whitespace. Não houve aumento de timeout, remoção de teste ou alteração em API, SQL, schema, gate financeiro, dependência ou configuração de Production.

O launcher continua apenas sintético. Seu alvo APPROVED permanece no deployment existente `dpl_HAbtXDcwSPoVpTbPVjzZmCUMneHU` e SHA implantado `9901db8b8e99ae510de9e3f63b61c6e39256befa`: publicar um novo commit não altera esse Preview nem permite mudar automaticamente o alvo. O novo SHA Git e a conferência final de PR/main/deployments são registrados no relatório de conclusão da publicação, sem incluir logs privados no repositório.
