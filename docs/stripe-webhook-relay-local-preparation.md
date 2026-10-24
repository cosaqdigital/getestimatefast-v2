# Preparação local do relay Stripe Sandbox — etapa 4

Registro histórico da preparação local. A revisão para publicação das etapas 4/5 na PR draft #60 está registrada na seção Etapa 6 de `stripe-relay-safe-adapters-local-report.md`; publicação Git não autoriza execução real ou deployment.

Base preservada: branch `feat/stripe-sandbox-safety-20261012`, HEAD `9901db8b8e99ae510de9e3f63b61c6e39256befa`. Alterações somente na árvore local, sem commit, push, PR, deployment ou configuração remota. Nenhum `stripe listen`, token OIDC real, whsec real, chamada à conta Stripe, envio ao Preview ou escrita no Supabase foi realizado.

## Auditoria

O handler hospedado verifica o corpo bruto com o SDK Stripe, recusa assinatura inválida antes do GET de identidade e confirma a conta test antes de persistir. Os quatro eventos solicitados estão mapeados. O gate de webhook é independente de Checkout, mas continua exigindo schema, isolamento, conta esperada e autorização explícita. O handler não utiliza o getter JSON de req.body; funções financeiras e esquema não foram alterados nesta etapa.

O relay original aceitava metadados manuais e qualquer string não vazia como OIDC, não tinha verificação local de assinatura, launcher, renovação ou encerramento coordenado. Seu único teste abrangia encaminhamento básico e isolamento de rotas. O limite de corpo dependia de um helper cujo erro poderia encerrar a conexão sem uma resposta previsível. A documentação antiga sobre disponibilidade da CLI e estado das variáveis foi tratada como histórico, não como estado atual.

## Correções locais

- `scripts/stripe-preview-relay.js`: exige verificadores de destino, assinatura e token; somente IPv4 127.0.0.1, Host loopback e POST no caminho exato; limite de 256 KiB inclusive chunked, 16 operações simultâneas, prazo total de até 20 segundos e resposta 413 para excesso de corpo. Não encaminha cookies/Authorization ou respostas privadas. Redirects são recusados; respostas 401/403/503/302 viram 503 genérico sem corpo. Fechamento aborta operações em curso e libera conexões. Buffers próprios são limpos.
- `scripts/stripe-preview-launcher.js`: biblioteca de preparação com início permitido apenas por adaptadores explicitamente sintéticos. Executá-la diretamente recusa iniciar conexão real. A API Vercel deve reconfirmar projeto/time, proteção, alias, deployment READY, branch, SHA e repositório; o envio usa a URL imutável daquele deployment. Isso evita que o token seja enviado a outro destino após movimentação de um alias. A verificação é repetida por requisição.
- Validador OIDC verifica assinatura RSA-SHA256 usando JWK, issuer permitido, audience, subject, projeto/time, environment development/preview e iat/nbf/exp, com margem de 30 segundos. Não confunde decodificação de JWT com autenticação e não busca URLs fornecidas no header do token. Obtenção/renovação é serializada; falha de renovação não reutiliza um token vencido.
- Captura de segredo em stdout/stderr privados, inclusive chunks divididos, sem imprimir os dados. Alteração inesperada do segredo encerra a operação. Segredo só é usado para verificação local de assinatura; nenhuma função instala variável Vercel. Processo filho, sinais e listener recebem limpeza coordenada.
- `tests/stripe-relay-launcher.test.js`: novos testes sintéticos; `tests/stripe-safety.test.js`: adapta o teste existente à interface com verificadores obrigatórios e cópia dos bytes antes da limpeza do buffer.

O processo JavaScript pode manter cópias internas de strings até a coleta de lixo. A limpeza zera os Buffers de propriedade da ferramenta e descarta referências, mas não promete eliminação física de todas as cópias na memória. Não há gravação de credenciais em disco, argv, logs ou relatórios.

## CLI conferida sem autenticação ou conexão

Stripe CLI oficial local: **1.53.1**. Executados somente `--version`, `listen --help` e `whoami --help`. O plano usa `--events` com os quatro eventos Checkout, `--events-from @self`, `--forward-to http://127.0.0.1:<porta>/api/stripe-test-webhook`, `--skip-update` e `--color off`. Não usa --live, --api-key, --headers, --print-secret, --skip-verify ou webhooks configurados. `whoami` real não foi executado.

Vercel CLI 63.1.2 não possui comando `oidc`. Foi consultado somente o help de `env run`, sem executar a obtenção de ambiente. A opção oficial futura a avaliar é capturar `VERCEL_OIDC_TOKEN` do processo filho de `vercel env run --environment development`, vinculado explicitamente ao projeto/time, sem env pull ou arquivo .env. Esse comando também injeta variáveis Development: sua execução deve ser autorizada separadamente e não pode ser usada para obter Secrets de Preview geral/Production. O adaptador de obtenção ainda não foi conectado à autenticação real.

## Verificação de identidade futura, antes de iniciar qualquer conexão

O launcher prepara verificação de GET Vercel `/v9/projects/<project>`, `/v4/aliases/<hostname>` e `/v13/deployments/<id>`, com autenticação oficial em memória e argumentos estruturados. Fixados projeto `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF`, time `team_vRw9eJBijmUFe1SbbOFY5xZs`, branch da #60, SHA acima, deployment `dpl_HAbtXDcwSPoVpTbPVjzZmCUMneHU` e alias já verificado nas etapas anteriores. Mudança de deployment exige nova revisão explícita, não atualização automática.

A leitura futura de Stripe whoami deve exigir versão 1.53.1, account_id `acct_1UOl9qH5rFe1usWF`, mode test e somente essa conta autorizada em test. Não há seleção automática de outra conta nem switch/login nesta preparação. Divergência interrompe antes de criar processo/listener.

A obtenção futura de JWKS deve usar discovery do issuer fixado `https://oidc.vercel.com` ou `https://oidc.vercel.com/get-estimate-fast`, conferir issuer/jwks_uri oficial, recusar redirects e impor timeout/limite de resposta. O teste fornece apenas JWK sintético RSA. Obtenção de chave pública, token real e validação de Trusted Sources continuam pendentes; não se afirma que o header OIDC real já foi aceito pela Vercel.

## Testes e evidências

Inicialmente, um teste com fetch não conseguiu substituir Host e retornou 204; foi corrigido para usar http.request, que envia o Host real pretendido. Não houve enfraquecimento do controle.

- Rodada focada: `node --test tests/stripe-relay-launcher.test.js tests/stripe-safety.test.js`: **38 aprovados, zero falhas/ignorados**.
- Suíte completa: `npm test`: **128 aprovados, zero falhas/ignorados**, incluindo PostgreSQL descartável, concorrência/idempotência e transportes financeiros simulados.
- Na repetição após o último guard de encerramento, a inicialização PostgreSQL do teste existente atingiu timeout de 30 segundos e deixou o runner pendente. A execução foi encerrada somente após identificar o PID e a cadeia de ancestrais do shell de teste; não foram encerrados serviços ou processos de outros projetos. Não houve alteração no helper financeiro ou SQL para mascarar a falha.
- Verificação final do código: `node --test --test-concurrency=1 tests/*.test.js`: **128 aprovados, zero falhas/ignorados**, em 72,2 segundos. O modo serial evitou o problema de inicialização observado na repetição paralela. Os 38 focados também passaram novamente com o código final. O timeout intermitente de PostgreSQL permanece uma observação do ambiente de testes, não um erro de assinatura ou relay.
- Evidências locais ignoradas: `test-output/stripe-relay-focused-tests.txt`, `test-output/stripe-relay-full-tests.txt` (repetição interrompida) e `test-output/stripe-relay-full-serial-tests.txt` (verificação final aprovada).
- Nenhum transporte remoto real é usado nos testes. Apenas HTTP em loopback é real; respostas Vercel, chaves RSA, assinatura Stripe, identidade, subprocesso e renovação são sintéticos.

Casos: assinatura válida/inválida/mutada, preservação UTF-8, limite com Content-Length e chunked, GET/rota/query indevida, Host de rebinding, OIDC ausente/expirado/forjado/projeto errado/Production, issuer/audience/time errados, renovação concorrente, 401/403/503/302 e resposta já redirecionada, timeout mesmo com transporte que ignora abort, falha de rede, destino alterado/fora do projeto, segredo dividido entre chunks/alterado, restrição de argumentos Stripe, encerramento voluntário e inesperado do filho e fechamento com operação em curso.

## Pendências e autorizações separadas

1. Revisar e aprovar os adaptadores reais de processo, Vercel API, JWKS e obtenção/renovação OIDC. Não há adaptador real pronto para uso nesta etapa, nem instalação adicional.
2. Autorizar leituras autenticadas futuras de identidade Vercel e Stripe; validar conta test e regras Development → Preview antes de abrir o transporte.
3. Autorizar stripe listen real com captura de whsec apenas em memória. A captura não equivale a cadastro de endpoint Stripe, e seu segredo deve ser o do transporte correto.
4. Autorizar separadamente o cadastro do whsec e o gate de webhook da branch, com Preview correspondente. Checkout e marketplace permanecem desligados. O endpoint atual continua desativado até essa configuração; preflight ready não autoriza processamento de eventos.
5. Só depois autorizar um envio sintético controlado ao Preview; pagamentos/Sandbox Checkout exigem outra autorização. Não fabricar confirmação financeira no banco.

O webhook real **não foi validado** por estes testes simulados. Supabase, Stripe, Vercel, main, produção, outras branches e Orçamentos Brasil não receberam alterações.

Referências oficiais: [Stripe listen](https://docs.stripe.com/cli/listen), [OIDC e validação JWKS](https://vercel.com/docs/oidc/reference), [Trusted Sources Development → Preview](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources).
