# Etapa 9 — preparação da validação OIDC do Preview autorizado

Data: 12/10/2026. Branch local: `feat/stripe-sandbox-safety-20261012`. HEAD preservado: `6386dd8f38f45f40056353b9f146b478556e3024`.

## Resultado efetivamente verificado

O relatório e as alterações locais da etapa 8 foram revisados. Permanecem locais: catálogo de deployments, launcher, relay, adaptadores e testes. Nenhum commit, push ou deployment foi executado nesta etapa.

As consultas autenticadas de leitura à API de controle Vercel confirmaram:

| Campo | Resultado |
| --- | --- |
| Projeto | `getestimatefast-v2`, `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF` |
| Time | `team_vRw9eJBijmUFe1SbbOFY5xZs` |
| Repositório / ID | `cosaqdigital/getestimatefast-v2` / `1211705834` |
| Branch | `feat/stripe-sandbox-safety-20261012` |
| SHA | `6386dd8f38f45f40056353b9f146b478556e3024` |
| Deployment | `dpl_AbusK9zKzKP8Ddejvu6VgNyV6jsx` |
| Estado / ambiente | READY / Preview (`target: null`) |
| Origem individual | `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app` |
| Alias | `getestimatefast-v2-git-feat-stripe-san-f12bd7-get-estimate-fast.vercel.app`, associado ao deployment autorizado |
| SSO | `all_except_custom_domains`, protege o hostname Vercel utilizado |

Os campos foram comparados pelo verificador estrito local da etapa 8, incluindo o vínculo GitHub do projeto e ref/SHA da fonte Git. O alias foi consultado somente na API de controle: não foi usado como destino HTTP da aplicação.

Consultas realizadas: `vercel whoami` e GET dos metadados `/v9/projects/<projeto>`, `/v4/aliases/<alias>` e `/v13/deployments/<deployment>`. A saída de identidade pessoal e os documentos completos foram mantidos apenas na memória do executor; foram emitidos somente resultados sanitizados. Não foram solicitados valores de variáveis, Secrets ou cookies.

A primeira tentativa de verificar os três endpoints sequencialmente por processos CLI ultrapassou o prazo total de 10 segundos antes de concluir a leitura do deployment. Não foi constatada divergência de identidade nessa tentativa; o documento ainda não estava disponível. Para diagnóstico, os documentos foram lidos separadamente com os limites próprios do subprocesso e o snapshot foi validado pelo mesmo verificador. O timeout do launcher não foi alterado. Essa validação do snapshot confirma metadados, mas não comprova que um futuro adaptador baseado em três processos CLI cabe no prazo operacional.

## CLI e disponibilidade do mecanismo OIDC

Vercel CLI **63.1.2**, disponível no cache local; autenticação existente confirmada por whoami. O vínculo `.vercel/project.json` corresponde ao projeto e time autorizados. Não houve instalação, login novo ou mudança de vínculo.

Foram consultados os helps locais de `env run` e `curl`, além da implementação instalada de `env run`. O comando suporta projeto explícito, escopo do time e ambiente Development. A documentação oficial descreve [env run](https://vercel.com/docs/cli/env) como injeção em processo filho sem exportação para arquivo. A implementação instalada também carrega `.env` do diretório de execução e permite que ambiente local/processo sobreponha valores baixados: o futuro executor deverá partir de diretório vazio e ambiente previamente filtrado, sem OIDC herdado, NODE_OPTIONS, VERCEL_TOKEN ou credenciais de aplicação herdadas.

O comando também obtém outras variáveis Development, além do token. Se essa leitura não puder ser restrita e aceita operacionalmente, parar e avaliar um mecanismo oficial que forneça somente o token, antes de executá-lo. Não utilizar env pull, imprimir ambiente ou gravar token em `.vercel`/`.env`/logs. Não obter valores de Preview geral ou Production.

O mecanismo foi verificado por help, código local e documentação; **nenhum token OIDC real foi obtido**. Não foram comprovados emissão, duração, claims reais, renovação, validação criptográfica real ou aceitação do header pelo deployment.

[Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources) documenta o header `x-vercel-trusted-oidc-idp-token` e o acesso padrão Development → Preview do mesmo projeto, sujeito às regras configuradas. A presença de SSO não prova por si só que a regra permite esse acesso. O teste real continua necessário e nenhuma regra foi alterada.

`vercel curl` é uma alternativa de diagnóstico suportada, mas um acesso por seu mecanismo de proteção não deve ser apresentado como prova da aceitação do header OIDC usado pelo relay. A preferência para comprovar o caminho do relay é um GET direto com OIDC validado e sem cookies/Authorization/bypass adicional.

## Solicitação HTTP preparada — requer autorização específica

**Não executada.**

- Deployment único: `dpl_AbusK9zKzKP8Ddejvu6VgNyV6jsx`.
- Método: **GET**.
- Origem: `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app`.
- Endpoint: **`/api/preview-readiness`**, sem query ou corpo.
- URL completa: `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app/api/preview-readiness`.
- Finalidade: comprovar acesso por OIDC ao endpoint da aplicação GetEstimateFast, preservando SSO e os bloqueios de pagamentos.
- Header sensível: somente `x-vercel-trusted-oidc-idp-token`, construído em memória. Não levar seu valor a argv, shell, console ou disco.
- Uma única tentativa de GET após nova conferência de identidade. Não seguir redirecionamentos, não tentar outro hostname, não repetir automaticamente após erro.
- Prazo HTTP limitado; resposta limitada e analisada apenas em memória. Emitir somente status e booleans/resultados sanitizados.

O código de `api/preview-readiness.js` foi revisado: aceita GET, exige Preview protegido, retorna apenas diagnóstico de configuração e não chama banco ou provedores. A identidade da aplicação será avaliada em conjunto com os metadados do deployment, e não somente por HTTP 200.

Antes do GET autorizado: obter token de curta duração sem persistência, verificar criptograficamente com discovery/JWKS do issuer oficial e exigir projeto/time/audience/subject/ambiente e validade previstos pelo validador. Se claims reais forem incompatíveis com o contrato, interromper e documentar; não relaxar regras automaticamente.

Critérios da resposta: nenhum redirect; content-type JSON; corpo objeto com `ready: true`, `configuration_only: true`, `database_integrity_verified: false`, `secret_values_printed: false`, `stripe_checkout_enabled: false`, `marketplace_enabled: false`, `stripe_test_account_configured: true` e listas de erros/variáveis ausentes vazias. Uma página HTML de login ou HTTP 200 com outro corpo não aprova o teste. Um 503 JSON legítimo será registrado como acesso à aplicação com configuração pendente, sem correção automática.

Este endpoint não possui atestação criptográfica própria de SHA/deployment nem expõe o flag do webhook. A identidade depende também da API Vercel, URL individual e TLS; o teste não substitui auditoria do banco nem reconfirma todas as variáveis financeiras. Não serão invocados `/api/stripe-test-webhook`, Checkout, reconciliação ou endpoints de escrita.

## Testes e auditoria desta etapa

- **91 testes focados aprovados**, zero falhas e zero skips: relay, launcher, adaptadores e segurança Stripe, somente mocks e HTTP loopback.
- Sete arquivos JavaScript da etapa 8 com sintaxe válida; auditoria sem candidatos a credenciais reais e com seis fixtures explicitamente sintéticas.
- Diff sem erros de whitespace; staging vazio; HEAD original preservado; deployment automático continua desabilitado no arquivo local.
- A suíte completa anterior de 184 testes está registrada no relatório da etapa 8; não foi repetida, pois não houve alterações no código da aplicação/launcher nesta etapa.
- Helpers e evidências locais em `test-output/` permanecem ignorados. Este relatório é o único novo arquivo de documentação para a etapa 9.

## Parecer e pendências

**Preparados para solicitar autorização do GET controlado; aceitação OIDC ainda NÃO comprovada.**

Restam: aprovação específica do GET e de sua obtenção OIDC em memória; confirmar emissão e claims reais; validar assinatura/duração; executar uma única solicitação ao hostname individual; verificar JSON esperado e aceitação de Trusted Sources. O futuro adaptador operacional também precisa resolver o custo de inicialização dos processos CLI sem aumentar silenciosamente o prazo de segurança ou usar snapshots como autorização contínua.

Não houve solicitações HTTP à aplicação Preview, Stripe listen, chamadas Stripe, mensagens, alterações Supabase/Vercel, configurações SSO, Secrets, variáveis, deploys ou operações Git de publicação. O início real do Stripe permanece bloqueado. Houve somente consultas remotas de leitura à API de controle Vercel e documentação pública; esta etapa não equivale a zero leituras remotas.

## Execução autorizada do teste OIDC — interrompida antes do GET

Após autorização específica do usuário, foi executado um operador local de tentativa única. Resultado: **Etapa 9 NÃO APROVADA; bloqueio no validador OIDC local, antes de enviar a requisição à aplicação.**

1. Reconfirmados pela API de controle Vercel: projeto, time, repositório, branch, SHA, deployment, hostname individual, Preview, READY, vínculo do alias e configuração SSO. O verificador estrito de identidade foi aprovado.
2. O token foi obtido por `env run --environment development` com projeto e time explícitos, em diretório temporário vazio, sem `.env` e com ambiente herdado filtrado. A saída do processo filho ficou em pipe privado/memória, sem saída do valor no terminal, ferramenta, relatório ou arquivo.
3. Os diagnósticos de formato mostraram iat/nbf/exp inteiros, projeto e time correspondentes, e ambiente Development. Essas comparações de campos decodificados não constituem verificação criptográfica.
4. `createOidcVerifier` recusou o token com o erro sanitizado `OIDC validation failed`. O validador atualmente combina checks de header/claims, fonte JWKS, assinatura e validade em uma exceção genérica. Portanto esta execução **não identifica qual desses checks falhou**, e não permite concluir que a assinatura está incorreta. Não houve relaxamento do contrato ou troca de mecanismo de autenticação.
5. A operação foi interrompida em `oidc_validation`. Token e referências foram descartados, Buffer próprio zerado e diretório temporário vazio removido. Nenhum token, cookie, payload privado ou documento integral de credenciais foi persistido. JavaScript não garante apagamento físico de todas as cópias internas de strings.

| Verificação | Resultado |
| --- | --- |
| Identidade do deployment | Aprovada |
| SSO configurado | Preservado |
| Token obtido em memória | Sim |
| Validação OIDC completa | Reprovada localmente; check exato não identificado |
| GETs ao Preview | **0** |
| HTTP status do Preview | **Não disponível: GET não executado** |
| OIDC aceito pela proteção Vercel | Não testado |
| JSON da aplicação | Não testado |
| Falha de autenticação Vercel | Não constatada; nenhuma requisição enviada |
| Falha da aplicação | Não constatada; nenhuma requisição enviada |
| Stripe real | Continua bloqueado |

Evidência local sanitizada: `test-output/stage9-oidc-authorized-result.json`. Operador local: `test-output/stage9-oidc-one-get.cjs`, sem retry automático; a existência do recibo impede repetição acidental. Não foi necessário criar o marcador de tentativa HTTP, pois o envio não chegou a ser autorizado pelo validador local. Nenhuma segunda tentativa de obtenção de token ou nova chamada foi executada após essa falha.

### Condições antes da Etapa 10

A próxima ação deve continuar sendo a Etapa 9: preparar diagnóstico granular exclusivamente sanitizado (booleans/códigos de categoria, sem valores de claims privados ou token), para distinguir header, claims, prazo, discovery/JWKS e assinatura, mantendo todos os checks. Uma nova obtenção OIDC/validação remota e eventual GET requerem nova autorização; nenhum novo acesso será feito automaticamente.

Caso seja necessária correção do contrato do validador, apresentar proposta sustentada no formato oficial antes de modificar regras de segurança; não aceitar JWT apenas decodificado. Depois de validar OIDC corretamente, reconfirmar identidade e realizar somente o GET especificamente autorizado, confirmar aceitação da proteção e JSON esperado.

Só após aprovação da Etapa 9 cabe definir e autorizar separadamente a Etapa 10, incluindo publicação do launcher local se necessária, solução do custo de processos CLI no prazo de verificação, validação de renovação/encerramento e escopo de eventual listener/segredo de webhook. Esta autorização não permite iniciar Stripe listen, habilitar webhook ou Checkout, obter whsec, instalar Secrets ou enviar eventos.

Nesta execução não houve chamadas Stripe, alterações Supabase/Vercel, mudanças SSO/variáveis/Secrets, commit, push, merge ou deployment. O código da aplicação e os controles do launcher não foram modificados; foram criados somente o operador/evidência local ignorados e atualizado este relatório.

## Subetapa 9.1 — diagnóstico e correções exclusivamente locais

### Causa comprovada e limite da investigação

**Não é possível determinar retrospectivamente a condição exata que recusou o token real.** Ele foi descartado, não foi persistido e não há autorização para obter outro. O recibo anterior registra apenas a fase `oidc_validation` e seis booleans de formato/identidade. Não registra header, issuer, audience, subject, resultado JWKS/assinatura ou comparação dos prazos. Essas informações não podem ser reconstruídas a partir do recibo.

A causa exata comprovada da falta de diagnóstico é o `catch` do antigo `createOidcVerifier`: qualquer falha de estrutura, identidade, tempo, fonte de chaves ou criptografia era substituída pela mesma mensagem `OIDC validation failed`. O loader e o manager também colapsavam falhas distintas. Não se atribui a recusa histórica a audience, issuer, assinatura, relógio ou rede sem evidência.

Foi comparado o contrato com a [referência oficial OIDC da Vercel](https://vercel.com/docs/oidc/reference), seção Token anatomy, consultada em 12/10/2026. RS256/JWT/kid, issuers global/team, audience padrão do time, subject e claims fixados correspondem ao formato documentado. Development pode ter validade de 12 horas; Preview de função, duas horas. Fixtures agora exercitam esses prazos. Renomear projeto/time ou usar custom audience exigiria revisão específica; nenhuma compatibilidade desse tipo foi presumida nem liberada.

**Nenhuma incompatibilidade do token real foi comprovada. Não houve relaxamento das regras para tentar fazê-lo passar.** O validador continua exigindo audience padrão exata em string, nomes e IDs exatos, ambiente Development/Preview, subject correspondente e timestamps inteiros. Não há tolerância nova de relógio, aceitação de Production/custom environment, mudança de issuer ou algoritmo adicional.

### Arquivos e alterações

- Novo `scripts/stripe-oidc-validation.js`: validador e loader compartilhados, 46 códigos fixos, classe `OidcValidationError`, categorias sanitizadas e função `diagnosticCode`. Não possui fetch/spawn padrão, aquisição de credenciais ou logs.
- `scripts/stripe-preview-launcher.js`: usa o módulo compartilhado; manager distingue falha de aquisição e preserva o código de validação, sem carregar o erro original/cause. Exportação de `createOidcVerifier` permanece compatível.
- `scripts/stripe-relay-adapters.js`: wrapper sintético de JWKS delega ao mesmo loader, preservando o bloqueio de execução real.
- Novo `tests/stripe-oidc-diagnostics.test.js`: tokens/JWKs sintéticos, casos positivos e negativos, cobertura de todos os 46 códigos declarados e privacidade de erros.
- `tests/stripe-relay-adapters.test.js`: checks de erro atualizados para códigos de HTTP/redirect.
- `test-output/stage9-oidc-one-get.cjs`: operador futuro utiliza loader compartilhado e registra somente código allowlisted no recibo. Foi inspecionado e alterado localmente, **não executado**. Recibo anterior preservado.
- Este relatório. Arquivos/evidências de `test-output/` permanecem ignorados pelo Git.

### Todas as condições de rejeição

| Camada | Códigos, com prefixo `OIDC_` |
| --- | --- |
| Estrutura/header | `TOKEN_TYPE`, `TOKEN_LENGTH`, `TOKEN_FORMAT`, `HEADER_JSON`, `CLAIMS_JSON`, `HEADER_OBJECT`, `CLAIMS_OBJECT`, `ALGORITHM`, `TYPE`, `KEY_ID`, `UNTRUSTED_HEADER` |
| Identidade fixada | `ISSUER`, `AUDIENCE`, `TEAM_ID`, `TEAM_SLUG`, `PROJECT_ID`, `PROJECT_NAME`, `SUBJECT` |
| Autorização local | `ENVIRONMENT` |
| Tempo | `CLOCK`, `EXP_TYPE`, `NBF_TYPE`, `IAT_TYPE`, `EXP_MARGIN`, `NOT_YET_VALID`, `ISSUED_IN_FUTURE`, `TIME_ORDER` |
| Obtenção/fonte/chave | `ACQUISITION`, `JWKS_UNAVAILABLE`, `JWKS_SHAPE`, `KEY_NOT_FOUND`, `KEY_AMBIGUOUS`, `KEY_METADATA`, `KEY_INVALID`, `SOURCE_ISSUER`, `SOURCE_TIMEOUT`, `SOURCE_NETWORK`, `SOURCE_HTTP`, `SOURCE_REDIRECT`, `SOURCE_LIMIT`, `SOURCE_JSON`, `DISCOVERY_ISSUER`, `DISCOVERY_URI` |
| Integridade criptográfica | `SIGNATURE_INVALID`, `SIGNATURE_ERROR` |
| Falha inesperada | `INTERNAL` |

Estrutura: somente JWT compacto de três segmentos e até 16 KiB; JSON UTF-8 válido e objetos; RS256/JWT e kid não vazio limitado. Headers que tentem fornecer chave/URL/extensão (`jku`, `jwk`, `crit`, `x5u`, `b64`) são recusados inclusive quando vazios/falsy. Nenhum valor desses campos entra em mensagens.

Tempo: números inteiros seguros, relógio finito, exp posterior a iat e nbf, mais de 30 segundos restantes e ausência de iat/nbf futuros. Rechecagem completa após lookup/assinatura. A ordem temporal é examinada antes dos checks de relógio, tornando seu diagnóstico alcançável sem permitir um token antes recusado.

Fonte de chave: emissor fixado, discovery/URI oficiais sem redirecionamento, autenticação ou query; prazo máximo de 10 segundos; limite de 64 KiB; JSON válido; no máximo 32 chaves em formato objeto. Um único kid deve corresponder, com chave pública RSA e alg/use compatíveis. Kid duplicado é recusado mesmo se uma entrada tiver metadata incompatível. Chave privada em JWKS e material RSA inválido são recusados.

Erro próprio transporta somente `code`, `stage`, nome e mensagem fixa, sem causa original. Na fronteira do validador o erro é reconstruído para impedir que até um erro tipado de dependência carregue mensagem privada. Manager não expõe erros de obtenção originais. A API pública do relay continua respondendo status sanitizado; códigos não são enviados ao cliente pelo endpoint hospedado.

### Distinção entre validação e acesso ao Preview

Decodificar e conferir estrutura não prova assinatura. A identidade/política local e tempo são checks necessários; o sucesso final também exige RSA-SHA256 usando a chave do issuer e rechecagem do prazo. Mesmo o sucesso criptográfico **não comprova autorização da proteção Vercel**: regras de Trusted Sources e retorno do endpoint permanecem uma etapa HTTP separada. Nenhum teste local declara a Etapa 9 aprovada.

### Evidências locais e pendências

Os testes cobrem cada código de rejeição, issuers global/team, Development/Preview válidos, prazos documentados, manipulação de assinatura, source offline/timeout/redirect/HTTP, metadata de chaves, aquisição/renovação e erros sanitizados. Os testes existentes do relay/launcher permanecem preservados. Resultados finais ficam em `test-output/stage91-focused.txt` e `test-output/stage91-full-serial.txt`.

Resultados finais desta subetapa: **176 testes focados aprovados** e **269 testes na suíte completa serial aprovados**, zero falhas/skips/cancelamentos. A suíte completa terminou em 120,0 segundos e inclui PostgreSQL local descartável. Foram adicionados 85 testes em relação à etapa 8; o teste final de cobertura exige que todos os 46 códigos tenham sido exercitados. Auditoria de dez arquivos JavaScript/CJS com sintaxe válida, zero candidatos a credenciais reais e seis fixtures explicitamente sintéticas. HEAD `6386dd8f38f45f40056353b9f146b478556e3024`, staging vazio e `git.deploymentEnabled=false` preservados. Diff sem erros de whitespace; avisos LF/CRLF são da configuração Git Windows.

Não houve novos tokens, consultas autenticadas Vercel, GET ao Preview ou operações Stripe nesta subetapa; somente leitura da documentação pública e execução local com mocks/loopback/PostgreSQL descartável. Nenhum commit, push, deploy ou alteração de infraestrutura.

Falta autorização separada para uma nova obtenção OIDC em memória e diagnóstico real com os códigos preparados; diante de falha, registrar somente o código e parar antes do Preview. Caso passe, ainda é necessário o GET único especificamente autorizado, com identidade reconfirmada, redirect bloqueado e JSON esperado. O operador anterior não deve ser reexecutado automaticamente nem ter seu recibo removido para provocar retry. Preparar uma nova tentativa identificada somente após autorização. Stripe permanece bloqueado.

## Subetapa 9.2 — tentativa real autorizada, encerrada por prazo do token

O operador confirmou explicitamente `AUTORIZO EXECUTAR A ETAPA 9.2`. Foi criada uma tentativa separada, preservando os recibos anteriores. O marcador exclusivo foi gravado antes das operações remotas para bloquear uma repetição acidental; não contém token ou credencial.

**Resultado: Etapa 9 ainda NÃO APROVADA. Código exato: `OIDC_NOT_YET_VALID`.**

O token capturado declara `nbf` maior que `Math.floor(Date.now()/1000)` no momento da validação. Essa é a condição precisa da rejeição nesta tentativa. As verificações anteriores de estrutura, issuer/audience, projeto/time, subject/ambiente, tipos e ordenação dos timestamps e margem de expiração passaram; são checks locais sobre campos decodificados. A validação foi interrompida antes do lookup JWKS e da assinatura, portanto a integridade criptográfica do token ainda não foi comprovada.

| Item | Resultado da tentativa 9.2 |
| --- | --- |
| Deployment/projeto/time/repositório/branch/SHA/URL | Reconfirmados conforme catálogo |
| Preview e READY | Confirmados |
| Configuração SSO | Preservada |
| Aquisições de token real | **1**, exclusivamente em memória |
| Tentativas de validação com token real | **1** |
| Código | `OIDC_NOT_YET_VALID` |
| GETs ao Preview | **0**, bloqueados pela falha local |
| HTTP status | Não disponível; GET não executado |
| Aceitação OIDC pela Vercel | Não testada |
| JSON esperado da aplicação | Não testado |
| Falha da proteção Vercel ou da aplicação | Nenhuma constatada; falha ocorreu localmente antes do HTTP |
| Token e runtime temporário | Referências descartadas, Buffer zerado, diretório vazio removido |
| Retries e redirects | Nenhum |

Possível causa: relógio local atrás do horário considerado pelo emissor, ou um `nbf` genuinamente futuro. A consulta exclusivamente local ao serviço Windows Time (`Get-Service W32Time`) encontrou **Stopped / Manual**. Esse estado sugere investigar sincronização, mas não prova o desvio: outras fontes de relógio podem existir. Não foi calculada a diferença exata, não houve consulta a fonte de hora remota e não se conclui a causa operacional além da condição rejeitada. Não se atribui este código retrospectivamente ao token descartado da tentativa anterior.

Nenhuma tolerância de relógio foi adicionada. Não houve espera para reaproveitar o token, segunda aquisição, tentativa automática, reinício do serviço, ressincronização ou alteração do Windows. Após a recusa só foram feitas verificações locais e atualização deste relatório.

Arquivos locais desta execução: `test-output/stage92-oidc-one-get.cjs`, `test-output/stage92-oidc-authorized-attempt.json` e `test-output/stage92-oidc-authorized-result.json`, ignorados pelo Git, além deste relatório. O operador teve sintaxe conferida antes de executar; não houve alteração do código do validador nem necessidade de repetir a suíte de 269 testes da 9.1. HEAD original e staging vazio preservados; diff sem erros de whitespace.

**Próximo passo antes da Etapa 10:** verificar a sincronização do relógio Windows e, se necessário, corrigir a hora mediante autorização própria. Depois será necessária nova autorização específica para uma única aquisição/validação OIDC e eventual GET condicionado ao sucesso. A aceitação hospedada e o JSON esperado ainda precisam ser comprovados; a Etapa 10 não foi iniciada.

Stripe permanece bloqueado. Não houve Stripe listen, pagamentos, eventos/webhooks, instalação de secrets, alterações Vercel/Supabase/SSO, commit, push, merge ou deploy. As únicas operações remotas desta tentativa foram as leituras de identidade Vercel e a aquisição OIDC oficial em memória; nenhuma requisição chegou à aplicação Preview.

## Subetapa 9.3 — diagnóstico do relógio Windows, sem correção

### Relógios e timezone

Leitura em 12/10/2026:

| Origem | Resultado |
| --- | --- |
| PowerShell local | `2026-10-12T17:58:40.6899484-04:00` |
| PowerShell UTC | `2026-10-12T21:58:40.6938673Z` |
| Node.js UTC | `2026-10-12T21:58:40.807Z` |
| Node.js Date.now() | `1791842320808` milissegundos Unix |
| Node.js segundos Unix | `1791842320` |
| Timezone Windows | `Eastern Standard Time`, base UTC−05:00 |
| Timezone Node.js | `America/New_York`, offset efetivo UTC−04:00 na data, horário de verão |

As leituras PowerShell/Node foram sequenciais; a pequena diferença entre elas inclui tempo de execução e não mede desvio entre processos. A apresentação local UTC−04:00 é coerente com o horário de verão, embora o offset base configurado seja UTC−05:00. Não há indício de erro de timezone.

### Windows Time e fonte configurada

| Comando/consulta | Resultado |
| --- | --- |
| `w32tm /query /status` | Falhou: serviço não iniciado, `0x80070426` |
| `w32tm /query /configuration` | Falhou: serviço não iniciado, `0x80070426` |
| `sc.exe query W32Time` | `STATE 1 STOPPED`, Win32 exit code `1077 (0x435)` |
| `Get-Service W32Time` | Stopped / Manual |
| Registro Parameters, somente leitura | `NtpServer=time.windows.com,0x9`, `Type=NTP` |
| Registro NtpClient, somente leitura | `Enabled=1`, `SpecialPollInterval=32768` |
| Policy Parameters | Chave específica não presente |

O peer configurado é **time.windows.com**. Como o serviço está parado, não foi possível confirmar fonte ativa ou último sincronismo por status runtime. Enabled=1 no registro não significa que o cliente esteja sincronizando enquanto o serviço está parado. Nenhuma configuração foi modificada.

### Desvio medido sem alterar o relógio

Executado o diagnóstico oficial [w32tm stripchart](https://learn.microsoft.com/en-us/windows-server/networking/windows-time-service/Windows-Time-Service-Tools-and-Settings), sem resync/config/start:

```text
w32tm /stripchart /computer:time.windows.com /dataonly /samples:3 /period:1
w32tm /stripchart /computer:time.nist.gov /dataonly /samples:3 /period:1
```

| Referência | Amostras de offset (segundos) | Média |
| --- | --- | --- |
| time.windows.com, 17:58:53–55 local | +6.7437066; +6.7428810; +6.7443601 | **+6.743649 s** |
| time.nist.gov, 17:59:24–26 local | +6.7597273; +6.7606448; +6.7582623 | **+6.759545 s** |

O offset NTP positivo indica referência à frente do computador: o relógio Windows está **aproximadamente 6,75 segundos atrasado** contra duas referências independentes. As amostras de cada referência foram consistentes; a pequena diferença entre servidores pode envolver as fontes e o caminho de rede. A medição não é uma atestação do relógio exato da Vercel nem uma reconstrução do nbf do token descartado.

### Revisão do cálculo temporal e tolerância

`times()` utiliza `Math.floor(now()/1000)`, e o now padrão é `Date.now()`: conversão correta de milissegundos Unix para segundos Unix. Compara diretamente `nbf`, `iat` e `exp` numéricos com esses segundos. Não há parsing de hora local, adição de offset timezone ou multiplicação equivocada dentro do validador. O manager converte `exp * 1000` ao comparar com Date.now(), também corretamente.

O validador recusa nbf ou iat futuros e exige mais de 30 segundos restantes até expirar. **A margem de expiração de 30 segundos não é tolerância de clock skew.** No código atual, tolerância para nbf/iat é zero. O arredondamento para segundos acrescenta no máximo uma fração de segundo de conservadorismo; não explica sozinho o desvio de cerca de 6,75 segundos.

O [RFC 7519, seções 4.1.4–4.1.6](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1.5) define NumericDate em segundos e permite pequena tolerância de skew para nbf/exp, mas não obriga um valor específico seguro para este projeto. Não há justificativa para liberar antecipadamente um token para compensar relógio comprovadamente atrasado. Nenhuma tolerância foi alterada.

Diagnóstico sintético local: mesma fixture assinada rejeitada com relógio injetado 6.744 ms atrasado, aceita exatamente em nbf e aceita 999 ms depois; três casos aprovados. Os **85 testes de diagnóstico OIDC passaram**, zero falhas/skips, incluindo timestamps e rechecagem após lookup. Artefatos ignorados: `test-output/stage93-temporal-synthetic.cjs` e `test-output/stage93-diagnostics-tests.txt`. Nenhum token real foi utilizado.

### Parecer e correção recomendada

**Causa provável fortemente sustentada: falta de sincronização do relógio Windows.** O atraso medido é compatível com OIDC_NOT_YET_VALID, e não foi encontrada conversão temporal/timezone incorreta. A relação exata com o token anterior ainda não pode ser demonstrada, pois ele foi descartado e seus timestamps não foram gravados.

Recomendação, somente após autorização: habilitar/verificar sincronização automática do Windows e sincronizar com a fonte confiável já configurada, preservando a timezone e sem modificar os checks JWT. Depois consultar status/fonte/última sincronização e medir novamente o offset com stripchart. Uma nova tentativa OIDC e eventual GET exigem autorização separada após essa verificação. Se a recusa persistir com relógio sincronizado, investigar a temporização do emissor/nbf com diagnósticos sanitizados.

Nesta subetapa não foram obtidos tokens, acessados Preview/Vercel autenticados, alterados relógio/serviço/registro/validador, executados Stripe, commit, push ou deploy. As únicas medições remotas foram consultas NTP de diagnóstico às duas referências, além da leitura de documentação pública. **Nenhuma correção foi aplicada; aguardando autorização.**

## Subetapa 9.4 — correção autorizada, bloqueada por falta de elevação

O usuário autorizou iniciar somente W32Time e executar sincronização com a configuração existente, mantendo seu tipo de inicialização e fonte NTP. A verificação inicial do token de acesso Windows, por `WindowsPrincipal.IsInRole(Administrator)`, retornou **false**. O terminal atual não dispõe de privilégios administrativos elevados.

Estado registrado em `2026-10-12T22:01:46.7174903Z`:

| Campo | Resultado |
| --- | --- |
| Terminal elevado | **Não** |
| W32Time | **Stopped** |
| Tipo de inicialização | **Manual** |
| NtpServer | **time.windows.com,0x9** |
| Type | **NTP** |
| Atraso anterior, Microsoft | **6.743649 s**, medido na 9.3 |
| Atraso anterior, NIST | **6.759545 s**, medido na 9.3 |
| Atraso posterior | Não medido; correção não executada |
| Resultado da sincronização | Não executada |
| Prontidão temporal para novo OIDC | Ainda não confirmada |

Conforme a instrução de interromper sem contornar permissões, não foram executados Start-Service, resync, elevação por UAC, mudança de configuração ou novas medições NTP. O serviço permaneceu parado nesta etapa.

Intervenção necessária: abrir **PowerShell como Administrador** no Windows. Nesse terminal elevado, executar o procedimento autorizado abaixo; o bloco interrompe diante de falha de início/sincronização:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    Start-Service -Name W32Time -ErrorAction Stop
    w32tm /resync
    if ($LASTEXITCODE -ne 0) { throw 'Sincronização falhou; interrompa e registre o erro acima.' }
    w32tm /query /status
    if ($LASTEXITCODE -ne 0) { throw 'Consulta de status falhou; interrompa.' }
    w32tm /query /source
    if ($LASTEXITCODE -ne 0) { throw 'Consulta de fonte falhou; interrompa.' }
}
```

Esses comandos não foram executados por Codex. Não usar config, Set-Service, troca de NTP ou tolerância JWT como recuperação automática. Depois do sucesso, ainda são necessárias medições stripchart contra ambas as referências e comparação Windows/Node.js antes de concluir que o relógio está suficientemente sincronizado. A política atual tem tolerância nbf/iat zero; um offset pequeno é evidência favorável, mas não garante sozinho a aceitação de um futuro token.

Não houve alteração do relógio, serviço, NTP, validador, Vercel, Stripe ou Git remoto. Nenhum token OIDC, acesso ao Preview, commit, push ou deploy. **Etapa 9.4 pendente de execução com elevação; nova tentativa 9.2 continua dependendo de autorização específica e validação temporal prévia.**

## Subetapa 9.5 — preparação após sincronização pelo operador

O operador informou ter sincronizado o Windows. Nesta preparação foram executadas somente consultas de leitura, medições NTP e testes locais. **Ainda não houve aquisição de token ou GET ao Preview na 9.5.**

### Identidade reconfirmada

O verificador estrito aprovou os documentos atuais da API Vercel: deployment `dpl_AbusK9zKzKP8Ddejvu6VgNyV6jsx`, projeto `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF`, time `team_vRw9eJBijmUFe1SbbOFY5xZs`, repositório `cosaqdigital/getestimatefast-v2` / ID `1211705834`, branch `feat/stripe-sandbox-safety-20261012`, SHA `6386dd8f38f45f40056353b9f146b478556e3024`, Preview (`target: null`), READY e URL individual `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app`. O alias esperado continua associado a esse deployment e SSO permanece `all_except_custom_domains`. CLI autenticada, vínculo local correto. Nenhum metadado ou configuração foi alterado.

### Relógio atual

- W32Time **Running**, tipo de inicialização **Manual**, preservado.
- `/query /status`: Leap Indicator **0**, stratum **5**, última sincronização com êxito em `12/10/2026 18:05:47`, fonte `time.windows.com,0x9`, intervalo 1024 s.
- `/query /source`: **acesso negado, 0x80070005** no terminal atual. A fonte foi confirmada pelo campo Source da consulta de status, que funcionou; não houve tentativa de elevar ou alterar permissões.
- Root dispersion informado: 7.7719084 s. É um diagnóstico de dispersão/incerteza NTP, não o offset instantâneo medido. Não se apresenta a hora local como uma atestação absoluta do relógio da Vercel.
- Windows local `2026-10-12T18:06:38.8050353-04:00`, UTC `2026-10-12T22:06:38.8058913Z`; Node.js UTC `2026-10-12T22:06:38.880Z`, Unix ms `1791842798881`, Unix s `1791842798`, timezone `America/New_York`. Leituras sequenciais coerentes.

| Referência | Offsets, segundos | Avaliação |
| --- | --- | --- |
| time.windows.com | −0.0007766; −0.0010085; +0.0002269 | Máximo absoluto **1,009 ms** |
| time.nist.gov | +0.0139094; +0.0131844; +0.0108313 | Máximo absoluto **13,909 ms** |

O atraso de aproximadamente 6,75 s foi substituído por diferenças da ordem de milissegundos. A medição é favorável para retomar o teste, mas não garante aprovação de nbf/iat sob tolerância zero nem comprova o relógio do emissor. Não houve alteração da margem de 30 segundos para exp ou dos demais checks temporais.

### Preparação e autorização pendente

**85 testes OIDC/temporais aprovados**, zero falhas/skips. Evidência local ignorada: `test-output/stage95-temporal-tests.txt`.

Operador futuro separado: `test-output/stage95-oidc-one-get.cjs`, syntax check aprovado, sem execução remota. Exige habilitação explícita do operador e utiliza marcador/recibo exclusivos da 9.5; não remove nem reaproveita recibos anteriores. Uma aquisição, uma validação real, zero retries. Só após validação local aprovada, identidade novamente conferida e prazo ainda válido será permitido um GET à URL individual exata, com redirect manual sem seguir Location e sem cookies/bypass adicionais.

Autorização específica a solicitar: **uma aquisição OIDC em memória e, condicionalmente, um GET `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app/api/preview-readiness`**, mantendo todos os controles e os 46 códigos sanitizados. Falha encerra a tentativa. Token será descartado e resultado sanitizado adicionado a este relatório. A autorização deve vir antes de executar esse operador; os comandos de preparação não a substituem.

Nesta preparação não houve token, GET ao Preview, chamadas Stripe, alterações relógio/serviço/NTP, infraestrutura, commit, push ou deploy. HEAD autorizado preservado, staging vazio. **Preparados para solicitar a tentativa 9.5; Etapa 9 ainda não aprovada, Stripe e Etapa 10 permanecem bloqueados.**

## Subetapa 9.5 — execução autorizada e aprovação da Etapa 9

Após confirmação explícita `AUTORIZO EXECUTAR A ETAPA 9.5`, foi executado uma única vez o operador preparado. **Etapa 9 APROVADA para o objetivo de validar OIDC e sua aceitação pelo Preview autorizado.** Os registros de bloqueios anteriores permanecem históricos.

| Verificação | Resultado final |
| --- | --- |
| Identidade completa do deployment | Reconfirmada antes da aquisição e novamente antes do GET |
| Deployment | `dpl_AbusK9zKzKP8Ddejvu6VgNyV6jsx`, READY, Preview |
| SHA | `6386dd8f38f45f40056353b9f146b478556e3024` |
| URL única acessada | `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app/api/preview-readiness` |
| Aquisições OIDC reais | **1**, exclusivamente em memória |
| Validação local | **Aprovada**: estrutura, identidade/política local, timestamps, discovery/JWKS e assinatura RSA-SHA256 |
| Validade emitida | 43200 s (**12 horas**, token Development); descartado após esta operação |
| Requisições ao Preview | **1 GET**, sem retry |
| Status HTTP | **200** |
| Redirects seguidos | **0**; resposta não redirecionada |
| Autenticação da requisição | Somente header `x-vercel-trusted-oidc-idp-token`, sem cookies, Authorization ou bypass adicional |
| Aceitação pela proteção Vercel | **Comprovada nesta requisição** pelo acesso à aplicação esperada sob SSO preservado |
| Content-Type e parsing | JSON / válido |
| Erros de autenticação ou aplicação | Nenhum nesta tentativa |
| Token/temporários | Descartados; Buffer zerado, runtime vazio removido |

A resposta foi conferida em conjunto com identidade API/TLS/hostname individual, não apenas pelo HTTP 200. Os seguintes campos esperados foram aprovados:

```json
{
  "ready": true,
  "configuration_only": true,
  "database_integrity_verified": false,
  "secret_values_printed": false,
  "stripe_checkout_enabled": false,
  "marketplace_enabled": false,
  "stripe_test_account_configured": true,
  "missing_variable_names": [],
  "errors": []
}
```

O endpoint é somente de configuração. O sucesso **não comprova integridade do banco, conectividade financeira Stripe, funcionamento de webhook ou autorização comercial**. O flag de webhook não é apresentado neste JSON e não foi reconfirmado por consultas adicionais. Nenhuma variável ou gate foi alterado. O início real do Stripe permanece bloqueado.

Evidências sanitizadas e ignoradas pelo Git: `test-output/stage95-oidc-authorized-attempt.json` e `test-output/stage95-oidc-authorized-result.json`. Não contêm token/cookie/credencial. O recibo impede repetição acidental. Não houve consultas remotas adicionais após o GET; somente atualização deste relatório e conferências locais.

O sucesso após a sincronização fortalece a conclusão de que o atraso Windows era o bloqueio operacional da 9.2. Não permite reconstruir o erro genérico do primeiro token descartado nem garantir estabilidade futura do relógio. A tolerância JWT continuou zero e nenhum check foi relaxado.

### Pendências e limites para a Etapa 10

1. Definir e autorizar separadamente o escopo da Etapa 10. Este sucesso não autoriza Stripe listen, whsec, eventos, pagamentos ou alteração de gates/infraestrutura.
2. Revisar/publicar as alterações locais das etapas 8/9.1, se necessário, mediante autorização própria: elas continuam sem commit/push e não fazem parte do SHA hospedado. Preservar o destino imutável e a cadeia da PR #60.
3. Resolver o custo de inicialização de múltiplos processos CLI no prazo operacional de verificação do launcher; o teste utilizou snapshots de leituras de identidade, não prova uma implementação contínua dentro do prazo de 10 segundos.
4. Preparar/validar obtenção, renovação e encerramento operacional de OIDC sem persistência. Uma aquisição real e um GET foram comprovados; renovação contínua e recuperação de falhas ainda têm somente evidências simuladas.
5. Reconfirmar previamente a conta Stripe Sandbox autorizada e versão/modo da CLI, caso a próxima etapa envolva listener. Aprovação adicional deverá definir captura do whsec em memória, eventual instalação branch-only de webhook secret, gate de webhook e testes sintéticos permitidos. Não executar essas ações automaticamente.
6. Manter Checkout e marketplace desativados, SMS dry_run e ausência de envios externos. Validar o recebimento/processamento do webhook apenas em etapa posterior explicitamente aprovada; preflight não é prova financeira.

Não houve Stripe listen, pagamentos, eventos/webhooks, alterações Supabase/Vercel/SSO/Secrets, mudanças de relógio, commit, push ou deploy nesta execução. **Etapa 10 não iniciada.**
