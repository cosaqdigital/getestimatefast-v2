# Avaliações Google: impedir formulário repetido

Branch feat/review-already-submitted-20261012, baseada no commit 2146b5e07c3c9eaaef18ba3de63d9f9f4aaa87d0 da PR draft #58. Todas as verificações remotas foram somente de leitura no Development cpjsbijgijeyrwjpuciv. Nenhum schema, dado, variável de ambiente, configuração OAuth ou Preview existente foi alterado.

## Causa e comportamento novo

A sessão da #58 verifica Google e convite, mas não procura a identidade associada a avaliações anteriores. A constraint impede a segunda gravação; isso acontece somente depois do envio e permite que o usuário preencha um formulário desnecessariamente.

A nova sessão verifica a identidade Google online, obtém o profissional exclusivamente do convite guardado no cookie cifrado e consulta um RPC que retorna somente booleano. O cliente recebe already_reviewed, sem nota, status de moderação, comentário, e-mail, UUID Auth ou subject Google. Query params do cliente não selecionam conta ou profissional.

Quando already_reviewed=true para a identidade autenticada e o contexto atual, o formulário e o botão de login ficam ocultos, o logout continua disponível e a mensagem recebe foco/aria-live:

"You've already reviewed this professional. Thank you for sharing your experience. Each Google account can submit one review per professional."

Uma nova conta sem avaliação mantém o formulário disponível. Um novo convite no fragmento não reutiliza o estado de outro profissional. Falha na consulta mantém o formulário oculto e informa indisponibilidade; não é tratada como ausência de avaliação.

Se outra aba gravar após a consulta, as constraints existentes continuam barrando o POST. Apenas violações conhecidas das constraints de identidade recebem code=review_already_submitted, que oculta o formulário e apresenta a mesma mensagem. Convites expirados/consumidos e erros desconhecidos não são confundidos com uma avaliação do próprio usuário.

## SQL preparado: depende de autorização adicional

Arquivo: supabase/prepared-migrations/20261012000100_authenticated_review_presence.sql. Está fora da pasta de migrações instaláveis automaticamente. Não foi aplicado remotamente.

Mudança exata: criar public.gef_authenticated_review_exists(uuid,text,uuid), STABLE, SECURITY INVOKER, search_path vazio; consultar somente gef_private.review_authenticated_identities; retornar EXISTS para o profissional e a identidade verificada pelo servidor (UUID Auth ou subject Google). Não há filtro de status: pending, approved, hidden e rejected ocupam a mesma posição única. O subject cobre a recriação legítima de um usuário Auth com a mesma conta Google. Avaliações antigas não verificadas não têm identidade autenticada e não bloqueiam por e-mail declarado.

EXECUTE é revogado de PUBLIC, anon e authenticated e concedido somente a service_role. Não criar tabelas/colunas, modificar constraints/RLS, expor o schema privado, conceder leitura a usuários, usar SECURITY DEFINER, alterar registros ou ampliar privilégios do avaliador.

Dependências: as quatro migrações Google da #57, incluindo gef_private.review_authenticated_identities e suas permissões de leitura service_role. O novo RPC ainda não existe no Development, confirmado por consulta de leitura. A versão atual do código não pode ser habilitada para sessões Google reais antes dessa instalação aprovada: a consulta ausente falha de forma fechada com HTTP 503.

## Testes e evidências

- 10 testes de backend/SDK real Supabase com transporte sintético, SQL local, UI, privacidade, erros e isolamento: todos aprovados.
- 6 testes em PostgreSQL nativo local, incluindo concorrência com conexões independentes, consumo único, duplicidade entre convites, subject após recriação Auth, autoavaliação e reputação: todos aprovados. O teste de sanitização de erros também passou nesse executor.
- Estados pending, approved, hidden e rejected exercitados no SQL local: already_reviewed=true para a conta correta. Conta distinta e outro profissional: false. IDs falsos em query params não mudam o resultado da sessão.
- RPC novo: anon/authenticated sem EXECUTE. Resposta de sessão contém apenas authenticated, profile, already_reviewed e csrf; sem dados privados da avaliação.
- Falha/ausência de RPC: sessão retorna 503 e frontend mantém o formulário oculto.
- 30 cenários em Chromium, somente fixtures: desktop 1440 e mobile 320/375/390/430 px. Mensagem exata, formulário oculto, logout, outra conta, conflito concorrente, falha de consulta, foco e zero overflow. Zero exceções JavaScript ou gravações remotas.

| Largura | Estados já avaliados | Conta diferente | Corrida/falha | Overflow |
|---|---|---|---|---|
| 1440 px | aprovado | aprovado | aprovado | 0 px |
| 320 px | aprovado | aprovado | aprovado | 0 px |
| 375 px | aprovado | aprovado | aprovado | 0 px |
| 390 px | aprovado | aprovado | aprovado | 0 px |
| 430 px | aprovado | aprovado | aprovado | 0 px |

No Development, os índices UNIQUE (contractor_id, reviewer_user_id) e UNIQUE (contractor_id, provider, provider_subject) continuam válidos e únicos, sem filtro de status. Não houve alteração dessas proteções.

Evidências: [mobile 390](evidence/review-presence/already-reviewed-390.png), [desktop 1440](evidence/review-presence/already-reviewed-1440.png), [medições](evidence/review-presence/results.json). Executor scripts/validate-review-presence-ui.js usa somente servidor loopback/fixtures e não autentica contas Google reais.

## Instalação, riscos e rollback para revisão

Após autorização separada, instalar apenas esse RPC no Development, conferir ACL/search_path/resultado booleano e negação a anon/authenticated. Preservar todos os dados e as 24 migrações anteriores. Não executar db push abrangente ou migrações não relacionadas.

Risco principal: publicar a API antes do RPC causaria 503 para sessões autenticadas com convite. Por isso, a nova branch está na proteção fail-closed de Preview e não recebeu variáveis/backend/OAuth remotos. A #58 permanece funcional e intacta; o ajuste ainda não está ativo no Preview existente. A configuração do Preview da nova PR e o teste Google interativo dependem das aprovações correspondentes.

Rollback operacional: manter/desativar a nova branch Preview e retornar ao código da #58 por processo autorizado, sem mudar a #58 nem remover dados. O RPC somente lê dados e pode permanecer sem uso; eventual remoção da função deve ser autorizada separadamente após retirar seus consumidores. Não apagar identidades, avaliações ou auditorias para permitir uma segunda avaliação.

Production, main, Orçamentos Brasil e outras branches intactos. Sem merge, envios, cobranças, novos usuários ou avaliações no Development. Nenhuma instalação de schema realizada.
