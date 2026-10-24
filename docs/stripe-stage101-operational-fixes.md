# Etapa 10.1 — correções operacionais locais

Branch `feat/stripe-sandbox-safety-20261012`, HEAD publicado preservado `6386dd8f38f45f40056353b9f146b478556e3024`. Somente código/testes/documentação locais. Nenhuma execução nativa Stripe/Vercel, token real, Preview, alteração financeira/infraestrutura ou publicação.

## Arquivos desta etapa

| Arquivo | Alteração |
| --- | --- |
| `scripts/stripe-preview-launcher.js` | Limites de início/refresh/cleanup, verificação paralela, classificação de saídas e ownership/limpeza coordenada |
| `scripts/stripe-relay-adapters.js` | Captura cancelável com exit code/signal; cleanup propagado; runner nativo sob autorização/planos registrados |
| `scripts/stripe-oidc-validation.js` | Cache opcional limitado de chaves públicas, sem dados de tokens |
| `scripts/stripe-operational-control.js` | Novo: erros operacionais fixos, deadline/cancelamento e status sanitizado |
| `scripts/stripe-native-processes.js` | Novo: processo Windows com argv estruturados, ownership e término de árvore/close sob autorização |
| `tests/stripe-operational-controls.test.js` | Novo: regressões de cleanup, start, concorrência, OIDC e gate nativo |
| `tests/stripe-relay-adapters.test.js` | Asserções de códigos/exit code/privacidade substituem comparações de mensagem genérica |
| Este documento | Relatório da 10.1 |
| `docs/stripe-stage10-readiness-audit-and-publication-plan.md` | Atualização de status da auditoria anterior |

Não alterados nesta etapa: API Checkout/webhook, SQL/schema/RLS, políticas financeiras, catálogo do deployment autorizado, packages/lockfile, vercel.json ou configurações hospedadas. Correções locais anteriores preservadas. Operadores e evidências ficam ignorados em test-output.

## Encerramento e erros

O launcher deixa de declarar limpeza concluída após rejeição do término do filho. Compartilha uma promise entre chamadas concorrentes; timeout/falha são propagados e registrados por código fixo. A propriedade do filho permanece até sucesso, permitindo **nova limpeza explicitamente solicitada** sem iniciar outro processo. Não há tentativa automática ilimitada.

O relay e seu loopback são fechados/abortados imediatamente, mesmo se a parada do filho falhar. Buffers e referências OIDC/assinatura são descartados; stdout/stderr restantes são drenados sem logs. Filhos que apareçam depois do cancelamento do início continuam sujeitos à limpeza. Sinais de interrupção são registrados antes do startup e removidos no encerramento.

O status distingue normal, saída inesperada, exit code não zero, SIGINT/SIGTERM, falha de início, timeout e falha de cleanup. `onStatus` recebe somente evento allowlisted, exitCode inteiro e sinal permitido: nunca mensagens de provider, stdout/stderr, segredo, cookie, token ou payload. O último evento conserva o motivo de interrupção/falha; uma falha histórica de cleanup não é apagada das evidências por uma limpeza posterior.

O runner não descarta erros de cleanup em capture/dispose. Se comando e limpeza falharem, preserva commandCode e exitCode/signal sanitizados junto à falha de término, sem cause/raw error. Há ownedCount para verificar recursos retidos e impedir declarar sucesso parcial.

O controller Windows preparado usa spawn/execFile com shell:false e windowsHide. Término da árvore é restrito ao PID do ChildProcess criado e pertencente ao controller, via taskkill /PID /T /F, sem descoberta de PIDs ou comandos montados em shell. Espera close; exitCode/killed isolados não são prova de encerramento de streams/descendentes. Se fechamento não é comprovado, retorna falha/timeout e mantém ownership.

**Limite físico:** o sistema operacional pode negar término ou deixar descendente escapar da árvore; Node/taskkill não equivalem a uma contenção Windows Job Object. Não se promete que um processo impossível de terminar tenha desaparecido. Nessa situação o encaminhamento fica fechado e o erro exige intervenção. Comprovação real de árvore, permissões e fechamento continua necessária em teste local nativo autorizado, com processo inofensivo primeiro. Nenhum processo Stripe real foi iniciado para testar isso.

## Adaptadores preparados e gate real

O caminho simulado permanece disponível. O novo createNativeProcessRunner exige objeto de autorização local congelado, purpose explícito, conta Sandbox, projeto/time, deployment/SHA/origem exatos, validade de no máximo 15 minutos e permissão listener booleana. Caminhos dos executáveis e runtime também têm que corresponder à autorização.

Não existe flag de ambiente que libere o modo real. Somente planos criados/registrados pelo módulo, com argv/options congelados, são aceitos pelo runner nativo; cópia/adulteração do plano é recusada. switch é proibido nesse executor; listen requer allowListener=true. Não há plano para Checkout, cobranças, trigger, live, configuração/env add ou deploy. O comando listen preparado continua @self, quatro eventos autorizados e loopback exato.

Vercel/Stripe adapters reconhecem runner nativo criado pelo módulo por WeakSet interno, em vez de aceitar objeto forjado ou um mock rotulado native. Diretório sem .env e environment filtrado continuam obrigatórios; expiração do grant é reavaliada antes de cada spawn. Nenhuma autorização nativa foi concedida/executada pelo agente nesta etapa: construções positivas nos testes não iniciam processos; todos os casos de spawn/taskkill usam mocks do sistema.

O objeto de autorização é uma capacidade de **código local confiável**, não uma assinatura criptográfica de aprovação humana; jamais aceitar grant de HTTP, env ou arquivo não revisado. Sua construção/uso em sessão real depende de autorização do operador e caminhos oficiais verificados. A entrada executável do launcher continua recusando início real e startSyntheticLauncher exige synthetic. A orquestração real completa e o encaminhamento hospedado precisam de integração/revisão separada; não usar o modo synthetic para disfarçar execução nativa.

## Limites operacionais

| Operação | Limite |
| --- | --- |
| Identidade deployment | **10 s**, três GET independentes paralelos, sem relaxar comparações |
| Identidade Stripe na inicialização | **10 s** |
| Startup completo do launcher | **30 s** incluindo todas as fases; configurable somente para diminuir nos testes |
| Obtenção + validação OIDC do manager | **10 s**, incluindo provedor que ignora cancelamento |
| Processo de captura | Até **20 s**; runner nativo preparado usa **10 s** por padrão |
| Cleanup do launcher/runner | **5 s** totais na envoltória; configurável somente para diminuir |
| Relay por request | **20 s**, mantido |
| Cache de JWK público | Até **60 s** em memória; sem stale fallback após erro/expiração |

GETs paralelos reduzem custo de inicialização de CLI, mas não provam latência real dentro do prazo: ainda é necessário benchmark operacional autorizado. Snapshots históricos não autorizam encaminhamento contínuo. O relay continua revalidando antes da aquisição e imediatamente antes do envio e bloqueia alias movement/retargeting.

## OIDC e renovação

Mantidos os 46 códigos de validação e todos os checks RS256/issuer/audience/subject/projeto/time/ambiente/timestamps. Tolerância nbf/iat segue zero; a margem exp continua 30 s. Não houve obtenção de token real ou mudança no relógio.

O manager reutiliza token somente acima de 60 s restantes e agora revalida cache, inclusive após relógio retroceder. Na janela de refresh, obtém uma vez para consumidores concorrentes e valida antes de armazenar. Timeout/dispose/invalidate cancelam a operação; resposta tardia não repopula cache. Uma requisição abortada não cancela indiscriminadamente o refresh compartilhado de outros consumidores; dispose cancela o owner. Falha não retorna token stale nem repete payload financeiro.

O cache de chaves públicas é opcional, serializa lookup por issuer e não conserva dados de token. Após TTL/erro não autoriza fallback stale. Dispose bloqueia novos retornos. É um recurso preparado para compor o executor futuro; não transforma um JWKS mock em fonte hospedada validada. Rotação de kid pode causar recusa até refresh explícito/TTL, preferindo bloqueio ao uso de fonte não validada.

## Testes e auditoria

Primeira rodada: duas falhas em testes antigos que exigiam igualdade da mensagem genérica. Foram investigadas e atualizadas para exigir PROCESS_EXIT_NONZERO/exitCode e PROCESS_CLEANUP_FAILED/privacidade, sem relaxar segurança ou aumentar timeouts.

Rodada focada final: **196 aprovados**, zero falhas/skips. Cobertura nova: cleanup falha/retry explícito; chamadas stop concorrentes; timeout; saída normal/erro/sinal; interrupção; início limitado; filho tardio após cancelamento; três leituras paralelas; refresh concorrente/expiração/falha/dispose; relógio retrocedendo; cache JWK; registry de comandos; grants nativos rejeitados; árvore owned/close/timeout com OS mocks; capture cancelada sem spawn e preservação de exit code/signal. Os testes de assinatura, isolamento e política financeira anteriores também passaram.

A suíte completa serial e auditoria final estão registradas em `test-output/stage101-full-serial.txt` e `test-output/stage101-publication-audit.json`. SQL usa PostgreSQL nativo descartável; Stripe usa transporte simulado. Nenhum test case faz stripe listen, chamadas financeiras ou HTTP ao Preview.

Suíte completa final: **289 aprovados**, zero falhas/skips/cancelamentos, em **93,9 segundos**. Foram acrescentados 20 testes operacionais em relação aos 269 da 10.0. As duas falhas intermediárias por contrato de erro foram resolvidas; nenhuma falha permaneceu e não houve aumento de timeouts para obter aprovação. Auditoria final: **16 arquivos no manifesto, 19 arquivos anteriores de evidência revisados, 19 JavaScript/CJS com sintaxe válida e zero candidatos a credenciais reais**; seis ocorrências explicitamente sintéticas. Hashes SHA-256 no recibo local; arquivos privados continuam excluídos. HEAD/origin/branch preservados, staging vazio, git.deploymentEnabled=false e diff sem erros de whitespace.

## Publicação e riscos restantes

O manifesto cumulativo proposto passa de 12 a **16 arquivos**, adicionando os dois módulos operacionais, o teste operacional e este documento. Hashes devem ser regenerados depois desta etapa; o manifesto da 10.0 é histórico. Não publicar operadores/test-output/.vercel/.env/supabase .temp ou untracked antigos não relacionados.

Antes de publicar: revisar diff/hashes/segredos, confirmar branch/origin/HEAD remoto e PR draft/base, staging explícito, suíte/sintaxe aprovadas e git.deploymentEnabled=false. Commit/push e eventual único Preview Git-source dependem de autorizações separadas. Novo deployment requer nova tupla autorizada, não atualização automática do alias/catalogue.

Restam provas operacionais: arquivos binários oficiais/CLI e permissões Windows, contenção da árvore/encerramento nativos, custo de GETs paralelos/OIDC/JWKS, renovação real controlada e composição segura do launcher real. Estas provas não podem ser substituídas por mocks. Se a latência exceder os prazos, revisar executor eficiente, sem aumentar limites silenciosamente.

A conta Stripe, listener/whsec, gates hospedados, assinatura end-to-end, confirmação SQL hospedada, Checkout e reconciliação permanecem sob aprovações próprias. API/schema/preços/contatos reais não foram alterados. Aprovação OIDC da etapa 9 continua específica ao GET validado, não concede acesso financeiro.

**Próxima etapa recomendada:** revisão do patch local e autorização separada para teste nativo inofensivo de lifecycle, sem Vercel/Stripe/OIDC, seguida de plano de publicação. Não iniciar a 10.2 automaticamente. Checkout, marketplace, webhook real e Stripe listen permanecem desativados/não executados pelo agente.
