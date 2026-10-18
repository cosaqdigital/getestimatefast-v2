# Etapa 8 — seleção segura do deployment para o relay Stripe

Execução exclusivamente local em 12/10/2026, na branch `feat/stripe-sandbox-safety-20261012`, sobre HEAD `6386dd8f38f45f40056353b9f146b478556e3024`. Não houve consultas autenticadas ou operações remotas. O estado hospedado não foi reconfirmado nesta etapa.

## Destino autorizado

| Campo | Valor esperado |
| --- | --- |
| Seleção explícita do catálogo | `pr60-stage7` |
| Deployment | `dpl_AbusK9zKzKP8Ddejvu6VgNyV6jsx` |
| SHA | `6386dd8f38f45f40056353b9f146b478556e3024` |
| Origem individual | `https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app` |
| Alias de identificação | `getestimatefast-v2-git-feat-stripe-san-f12bd7-get-estimate-fast.vercel.app` |
| Projeto | `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF` |
| Time | `team_vRw9eJBijmUFe1SbbOFY5xZs` |
| Repositório / ID | `cosaqdigital/getestimatefast-v2` / `1211705834` |
| Branch / ambiente | `feat/stripe-sandbox-safety-20261012` / `preview` |
| Sandbox Stripe preservada | `acct_1UOl9qH5rFe1usWF` |

O deployment anterior `dpl_HAbtXDcwSPoVpTbPVjzZmCUMneHU` não pertence ao catálogo ativo e é recusado pelos planos dos adaptadores. Referências a ele nos testes são casos de rejeição; documentos das etapas anteriores são históricos.

## Arquivos locais

- Novo `scripts/stripe-authorized-deployments.js`: contrato tipado por JSDoc, catálogo imutável e validadores. Centraliza a tupla autorizada; não carrega configuração de `.env`, CLI, arquivo privado ou resposta remota.
- `scripts/stripe-preview-launcher.js`: seleção obrigatória por chave do catálogo, verificação de identidade com prazo total de 10 segundos e encerramento coordenado por falha de destino.
- `scripts/stripe-preview-relay.js`: recusa destinos fora do catálogo; copia e congela metadados; revalida antes de obter OIDC e imediatamente antes do envio; bloqueia permanentemente após falha de destino.
- `scripts/stripe-relay-adapters.js`: planos GET limitados ao projeto, alias e deployment selecionado. Continua sem executor nativo ou autenticação real habilitada.
- `tests/stripe-relay-launcher.test.js`, `tests/stripe-relay-adapters.test.js`, `tests/stripe-safety.test.js`: fixtures adaptadas e cenários adicionais de segurança.
- Este relatório. Evidências e auditor local ficam em `test-output/`, ignorado pelo Git.

Nenhuma API hospedada, migração, função SQL, gate financeiro, pacote, lockfile ou configuração Vercel foi alterada.

## Lacunas encontradas e correções

A revisão anterior conferia o repositório por ID, mas não conferia também o vínculo GitHub do projeto. Além disso, aceitava qualquer hostname individual `.vercel.app` retornado com os metadados esperados. O verificador agora exige o vínculo GitHub exato, fonte GitHub com ID/ref/SHA esperados e o hostname individual exato do catálogo.

A verificação inicial dependia do prazo do adaptador. Agora possui prazo próprio e cancelamento limitado mesmo quando um transporte simulado ignora AbortSignal. Falhas são sanitizadas, sem incluir o conteúdo da API.

A renovação OIDC podia criar um intervalo entre conferir o alias e enviar. A identidade é conferida novamente na fronteira do envio. O token só pode ser encaminhado à origem individual fixada. O alias serve exclusivamente para verificar se ainda identifica esse deployment; jamais é destino do POST.

Mudança de alias, identidade inconsistente, timeout ou falha da API bloqueia o relay, aborta requisições pendentes e dispara a limpeza do launcher. Não há retargeting, tentativa automática de adotar outra implantação ou reinício do listener. É necessário corrigir a causa e iniciar uma nova execução autorizada.

## Verificação preparada

Os mocks fornecem documentos de GET `/v9/projects/<projeto>`, `/v4/aliases/<alias>` e `/v13/deployments/<id>`. São exigidos projeto/time, vínculo GitHub, ID de repositório, branch e SHA em ambas as fontes, `target: null` (Preview), READY, hostname individual e associação do alias ao deployment. SSO deve ter `deploymentType: all_except_custom_domains`, que protege os hostnames Vercel utilizados.

Documentos incompletos, arrays, erros e respostas indicando redirects são recusados. A futura implementação real do transporte terá que preservar essa regra também na camada HTTP; os planos CLI não constituem prova de que uma chamada real não segue redirects. Nenhuma autenticação real foi exercitada.

## Testes

Comandos locais executados:

```text
node --test --test-concurrency=1 tests/stripe-safety.test.js tests/stripe-relay-launcher.test.js tests/stripe-relay-adapters.test.js
node --test --test-concurrency=1 tests/*.test.js
node --check <cada um dos sete arquivos JavaScript desta etapa>
git diff --check
```

Testes focados: **91 aprovados, zero falhas**, incluindo os testes anteriores. Suíte serial completa: **184 aprovados, zero falhas, zero skips**, em 167,8 segundos, com 32 novos testes em relação à base. Evidência local: `test-output/stage8-full-serial.txt`.

A suíte completa validou a instalação SQL em PostgreSQL nativo vazio, os fluxos de avaliações/reputação, dois clusters locais independentes, reservas financeiras, concorrência/idempotência e reconciliação Stripe simulada. Todos os bancos eram descartáveis locais; não houve conexão ao Supabase Development ou Production. Nenhum teste falhou; não foi necessário modificar timeouts existentes ou gates financeiros.

Cobertura adicional: seleção ausente/arbitrária/objeto/ID aposentado; ID/SHA/ref/time/projeto/repositório incorretos; estado BUILDING; Production e ambiente ausente; SSO ausente; alias movido; hostname individual divergente ou alias usado como destino; documentos incompletos; falha e timeout da API; mudança de alias em execução e durante renovação OIDC; limpeza após falha; mutação de objeto do chamador.

Cobertura preservada: bytes UTF-8 e assinatura Stripe, assinatura inválida, 256 KiB inclusive chunked, Host loopback, rotas/métodos restritos, OIDC inválido/expirado/adulterado, renovação serializada, HTTP 401/403/503/302 e redirects, falhas de conexão, cancelamento, captura sintética de segredo em memória, encerramento de processos simulados, ausência de herança de credenciais e bloqueio de `.env` no diretório de execução.

Auditoria local: sete JavaScript com sintaxe válida, zero candidatos a credenciais reais, seis ocorrências explicitamente sintéticas. Diff sem erros de whitespace; avisos LF/CRLF decorrem da configuração Git Windows. HEAD preservado, staging vazio e `git.deploymentEnabled=false` preservado.

## Atualização futura controlada

1. Obter autorização humana para a tupla completa de deployment, SHA e hostname individual. Não aceitar atualização automática de alias como autorização.
2. Revisar apenas a entrada do catálogo de origem para esse destino e retirar entradas aposentadas. IDs, URLs e SHA ficam centralizados; adaptadores não possuem outra lista de destinos.
3. Fornecer explicitamente a chave aprovada em `deploymentSelection` ao launcher e ao criador de planos `commands`. Sem chave não há inicialização.
4. Executar novamente cenários de incompatibilidade, testes completos e auditoria de segredos. Publicação e execução real precisam de autorizações próprias.
5. Na futura execução hospedada autorizada, comparar documentos Vercel reais, inclusive seus tipos/campos, com o contrato. Qualquer divergência deve interromper; não relaxar checks automaticamente.

## Riscos e pendências

O catálogo é uma allowlist revisada em código, não uma autorização dinâmica concedida por metadados. Adaptadores injetados nos testes são código confiável do teste; rotulá-los synthetic não é uma fronteira contra execução arbitrária de código pelo próprio operador.

Leituras de API e envio não são uma transação atômica. A rechecagem reduz o intervalo de corrida; mesmo se o alias mudar após a última leitura, a requisição continua presa à URL individual autorizada e não segue o alias. Eventos já enviados antes da detecção não podem ser desfeitos pelo launcher.

Falta validar, sob autorização separada, as respostas reais da Vercel, o esquema dos claims/JWKS OIDC, renovação e aceitação de Trusted Sources pelo Preview mantendo SSO. Nenhum token real foi obtido, nenhum `stripe listen` foi iniciado, nenhum segredo de webhook foi capturado ou instalado. Falhas de encerramento do executor nativo futuro também precisam de validação operacional; hoje apenas processos simulados são exercitados. Buffers próprios são zerados, mas JavaScript pode manter cópias internas de strings até coleta de lixo.

Checkout, webhook e marketplace não foram habilitados. Não houve chamadas Stripe, envio ao Preview, alterações Supabase/Vercel, commit, push, PR, merge ou deployment. **Zero operações remotas. A integração real não está declarada funcional.**
