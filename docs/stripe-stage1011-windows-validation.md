# Etapa 10.1.1 — validação operacional nativa no Windows

Validação local autorizada, executada em Windows 11 Pro 10.0.26200, Node v24.16.0. Nenhum acesso a Stripe/Preview, token OIDC real, listener financeiro, Checkout, marketplace, commit, push ou deploy. Infraestrutura, variáveis e configurações de segurança preservadas.

## Resultados

| Execução final | Resultado | Duração |
| --- | --- | --- |
| `node --test tests/stripe-windows-native.cjs` | 11 aprovados, zero falhas/skips/cancelamentos | 35,414 s |
| `node --test --test-concurrency=1 tests/stripe-*.test.js` | 217 aprovados, zero falhas/skips/cancelamentos | 27,387 s |
| `node --test --test-concurrency=1 tests/*.test.js` | 291 aprovados, zero falhas/skips/cancelamentos | 123,146 s |

O harness nativo `.cjs` exige execução explícita e Windows; não entra no glob cotidiano `.test.js`. As 11 provas nativas são adicionais à suíte de 291. As 217 provas focadas são subconjunto da suíte completa. PostgreSQL da regressão usa clusters locais descartáveis; Stripe e provedores externos usam fixtures.

Evidências locais ignoradas pelo Git: `test-output/stage1011-native.txt`, `stage1011-native-metrics.json`, `stage1011-focused.txt`, `stage1011-full.txt`, `stage1011-publication-audit.json` e `stage1011-source-baseline.json`.

## Processos reais, descartáveis

O controller nativo existente executou somente o próprio Node e uma fixture temporária, com executable/argv validados, `shell:false`, `windowsHide:true`, ambiente filtrado e diretório sem `.env`. A autorização local congelada foi usada somente pelo controller com validador restrito à fixture; não foi passada autorização executável Stripe/Vercel ao runner financeiro. No runner de captura, as dependências injetadas chamam spawn/taskkill reais deste controller; nenhum mock substitui o sistema operacional. O modo synthetic do runner indica o adaptador local de teste, não uma aprovação de uso financeiro.

Árvores de três gerações reportam seus PIDs e expiram por conta própria em 30 s como proteção do harness. Na saída cooperativa, pais aguardam o fechamento dos filhos. No término forçado, o controller usa `taskkill.exe /PID <PID próprio> /T /F` e aguarda `close`. Probes de existência são restritos aos PIDs reportados pelas fixtures; nenhum PID alheio é terminado.

| Caso | Medição final | Resultado |
| --- | --- | --- |
| Saída normal da árvore | 554,28 ms | exitCode 0, signal null, 3 processos encerrados |
| Falha da árvore | 708,53 ms | exitCode 23 preservado, signal null, 3 encerrados |
| Término forçado da árvore | 554,92 ms após readiness | 3 encerrados; Windows reportou exitCode 1, signal null |
| Captura com timeout | operação 10.024,31 ms + cleanup 570,48 ms | PROCESS_TIMEOUT; 3 encerrados, ownership zerado |
| Captura cancelada | operação 411,54 ms + cleanup 594,06 ms | OPERATION_ABORTED; 3 encerrados, ownership zerado |
| SIGTERM emitido pelo pai | 208,91 ms | PROCESS_INTERRUPTED e SIGTERM preservados; filho encerrado |

Ao todo, 16 processos foram observados na rodada final. Todos foram verificados ausentes após cada cenário e novamente ao final. Uma consulta independente Win32_Process pelo marcador exclusivo do caminho da fixture confirmou **zero processos restantes**. O controller recusou a tentativa de parar um objeto não pertencente a ele. O harness removeu seu arquivo e diretório temporários.

A primeira rodada teve 8/9 aprovados: a fixture emitia SIGTERM sobre si mesma, e o Windows reportou código de saída em vez de sinal. A asserção POSIX incorreta foi substituída por emissão do sinal pelo pai, cujo ChildProcess conserva SIGTERM. Não se inventou sinal para taskkill nem se alterou o código de produção para mascarar o resultado do Windows.

## Identificação e limites

Três fixtures independentes de identidade, cada uma com atraso de 250 ms, completaram em **253,98 ms**, com pico de concorrência 3. As comparações de projeto/time/repositório/deployment/SHA/alias permaneceram integrais, usando somente objetos locais.

O prazo padrão de 10.000 ms foi observado em **10.016,97 ms**, com os três sinais cancelados. Respostas resolvidas após o cancelamento não autorizaram a operação. Cancelamento externo e falha do provedor também recusaram a verificação e abortaram o escopo dos irmãos. As durações agregadas destes dois casos (180,86 ms e 124,94 ms) incluem 120 ms de espera deliberada pelas respostas tardias.

Timers Node/Windows têm latência de agendamento; não são deadlines de tempo real rígido. Não houve aumento do limite. O retorno de captura inclui a limpeza posterior ao timeout de operação, explicitamente medida separadamente. Um provedor que ignora AbortSignal pode continuar seu trabalho local; seu resultado é recusado. A fixture de identidade tardia termina por si; filhos nativos são encerrados pelo controller.

## OIDC sintético e correções locais

Tokens RS256 são gerados em memória com chave RSA descartável. JWKS e aquisição são funções locais, sem fetch, CLI ou material real. O avanço de relógio é injetado no verifier/manager e não muda o relógio do Windows.

Expiração recusa OIDC_EXP_MARGIN; refresh de consumidores concorrentes obtém uma única renovação; falha de aquisição recusa OIDC_ACQUISITION sem fallback expirado. Cancelamento prévio recusa OPERATION_ABORTED sem iniciar aquisição. O timeout padrão do manager foi medido em **10.000,79 ms**, com sinal do provedor abortado. Resposta tardia foi liberada após uma nova renovação válida e não repopulou nem apagou o cache atual.

Duas correções em `scripts/stripe-preview-launcher.js`, com regressões em `tests/stripe-operational-controls.test.js`:

- Recusar consumidor já cancelado antes de iniciar aquisição OIDC compartilhada.
- Condicionar limpeza do cache à geração correspondente, impedindo que validação antiga/tardia apague uma renovação posterior. A mesma proteção foi aplicada à revalidação de cache.

As regressões e todos os testes afetados passaram; a suíte completa cresceu de 289 para 291. Não foram alterados margens de expiração, tolerâncias temporais, políticas financeiras ou gates.

## Auditoria e prontidão

Gates de processos reais e launcher permanecem fechados sem autorização explícita; registry rejeita clones, switch e listener não autorizado. Os testes de segurança verificam Checkout fechado por padrão, ambiente production/live recusado e políticas de webhook preservadas. Nenhum adapter iniciou Stripe CLI, Checkout ou webhook real nesta etapa.

A auditoria histórica `audit-stripe-source-integrity-local.cjs` falhou porque exige APIs idênticas ao PR51 (`5d852ff`), enquanto o HEAD atual já contém alterações anteriores nos três arquivos de API. O diff entre esses commits confirma 71 inserções/29 remoções anteriores. SQL permaneceu idêntico à referência histórica. A auditoria atual compara APIs/SQL/configuração/packages ao HEAD `6386dd8f38f45f40056353b9f146b478556e3024`; não houve mudança nesses arquivos nesta etapa. O auditor histórico não foi alterado nem sua falha apagada.

Auditoria final de publicação: manifesto cumulativo de 18 arquivos, 19 evidências históricas revisadas, 20 arquivos JS/CJS com sintaxe válida, zero candidatos a credenciais reais nos arquivos do manifesto e evidências históricas auditadas, staging vazio, HEAD/branch/origin preservados e deploy automático desabilitado. A comparação com HEAD confirmou 10 arquivos de API/SQL/configuração/packages inalterados; uma busca adicional de padrões de credenciais nos 18 arquivos do manifesto também encontrou zero candidatos. Hashes SHA-256 no recibo local. Esta afirmação de credenciais cobre o conjunto auditado; arquivos privados existentes `.env`, `.vercel`, temporários e evidências não pertencem à publicação. `git diff --check` aprovado. A inspeção final de processos também não encontrou postgres.exe, pg_ctl.exe, initdb.exe ou taskkill.exe ativos.

Riscos residuais: taskkill não oferece contenção Windows Job Object; processos destacados ou reparentados que escapem da árvore não têm garantia de encerramento. As árvores cooperativas e vivas testadas foram comprovadamente encerradas, sem reivindicar cobertura universal. Latência e permissões de executáveis Stripe/Vercel reais, JWKS remoto, renovação real, Trusted Sources hospedado e composição do launcher real continuam sem validação nesta etapa. Os timers têm jitter e podem levar alguns milissegundos além do prazo configurado; cleanup adiciona latência explícita. O runner real não deve ser habilitado com base apenas nestas fixtures.

**Podemos avançar para a Etapa 10.2 — publicação controlada no Preview do patch revisado, mantendo Checkout, marketplace e operações financeiras reais bloqueados.** Antes de qualquer publicação: revisão do manifesto/hashes, staging explícito apenas dos arquivos autorizados, autorização separada para commit/push/deploy e nova tupla de deployment revisada quando houver Preview novo. A prontidão é para publicar código sob os gates atuais, não para habilitar operações Stripe reais. Nenhuma publicação foi executada.
