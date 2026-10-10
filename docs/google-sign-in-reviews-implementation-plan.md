# Plano — Google Sign-In para avaliações

Base: PR draft #56. Ambiente exclusivo: Supabase Development `cpjsbijgijeyrwjpuciv` e Preview protegido. Documento para aprovação; **nenhuma migration aplicada, OAuth configurado ou recurso externo criado**.

## 1. Experiência proposta

O cliente abre o convite existente, vê o profissional e toca em **Continue with Google**. O Google autentica a conta; o Supabase cria ou reutiliza o usuário Auth automaticamente. Não há senha GetEstimateFast, formulário de cadastro, perfil de cliente obrigatório ou e-mail de confirmação enviado pela plataforma.

Após o retorno, o mesmo convite é recuperado. O cliente escolhe o nome que deseja publicar, nota e comentário, confirma o consentimento e envia para moderação. O e-mail não aparece no formulário público nem no perfil. Mensagens e interfaces serão em inglês americano.

Estados explícitos: login necessário, autorização Google cancelada, sessão expirada, convite indisponível, avaliação já enviada, proprietário não pode avaliar o próprio perfil, aguardando moderação e falha temporária. Nome visível, consentimento e comentário não são publicados automaticamente a partir do perfil Google.

Uma avaliação por conta por profissional, incluindo avaliações pending, approved, rejected e hidden. Rejeitar/ocultar não libera uma segunda avaliação. Edição ou recurso contra rejeição não entram nesta primeira implementação.

Autenticação Google identifica a conta; não comprova contratação, execução do serviço ou identidade civil. Avaliações externas continuam marcadas como externas e nunca como compras verificadas. Contas Google diferentes continuam sendo contas diferentes: OAuth não impede sozinho manipulação por várias contas; moderação, limites e denúncias permanecem necessários.

## 2. Arquitetura de autenticação e convite

Fluxo: convite → endpoint de início → Supabase Auth/Google com PKCE → callback do Preview → formulário → API autenticada → transação SQL → moderação → reputação pública.

Novos endpoints propostos, exclusivamente no Preview isolado:

| Endpoint lógico | Responsabilidade |
| --- | --- |
| `POST /api/reviews/auth-start` | Validar contexto do convite, origem e CSRF; iniciar Google OAuth via Supabase com PKCE |
| `GET /api/reviews/auth-callback` | Trocar o código por sessão, validar retorno e recuperar o convite; redirecionar para um caminho fixo |
| `GET /api/reviews/session` | Informar somente estado autenticado e dados mínimos de apresentação; sem e-mail, token ou IDs privados |
| `POST /api/reviews/submit` | Validar sessão no Supabase, identidade Google, consentimento e conteúdo; chamar a nova função SQL |
| `POST /api/reviews/logout` | Encerrar sessão de avaliações e limpar cookies/contexto |

Esses endpoints são de autenticação/avaliação, não endpoints administrativos. Não expõem a Secret Supabase nem oferecem criação administrativa de usuários. Os endpoints administrativos existentes continuam exigindo associação real em `admin_users`.

### Sessão e segurança

- Usar SDK oficial Supabase, com versões fixadas e lockfile. Integração server-side adaptada às funções Node existentes; não requer migrar o projeto para Next.js.
- A sessão específica de avaliações só é emitida após o callback Google concluído. Não basta apresentar um JWT de login por senha, mesmo que o usuário já tenha uma identidade Google vinculada; o contexto de callback e a sessão validada ficam vinculados no servidor.
- Fluxo PKCE com troca do código no servidor. Sessão em cookies Secure, HttpOnly e SameSite=Lax, adapter server-side e tratamento de chunking/refresh. APIs de avaliação validam o usuário com `getUser`, sem confiar apenas em dados locais de sessão.
- Proteger POSTs por origem exata e CSRF. Callback usa a origem configurada/permitida; não usa `Host`, `next` arbitrário ou domínio de produção como fallback.
- O convite atual continua no formato `/review.html#token`. O navegador remove o fragmento da URL e entrega o token ao servidor por POST. Um cookie de contexto criptografado, curto e HttpOnly preserva convite/nonce durante OAuth; não colocar o convite em parâmetros de Google/Supabase ou logs. Se o contexto expirar, reabrir o convite original, sem consumir o convite.
- Separar cookies de sessão de avaliações dos logins profissionais/administrativos existentes; o login como cliente não cria `contractor_profiles`, carteira ou privilégio administrativo.
- Não salvar tokens de acesso Google, solicitar acesso offline ou escopos de Gmail/Drive. Somente os escopos de identificação requeridos pelo Supabase.
- O adapter de persistência deverá excluir `provider_token` e `provider_refresh_token` antes de salvar a sessão; persistir somente credenciais Supabase necessárias. Isso precisa de teste específico, pois usar a persistência padrão do SDK sem revisar o payload pode guardar os tokens do provider.
- Manter SSO Vercel. O callback deve retornar à mesma origem Preview estável onde começou o fluxo; testar o retorno com a sessão Vercel existente. Testadores precisarão de acesso ao Preview e de contas Google de teste autorizadas. Nenhum bypass permanente será criado.

### Identidade confiável e autoavaliação

O backend usa o usuário validado no Supabase e sua identidade `provider=google`. IDs enviados no formulário, e-mail digitado e `user_metadata` não autorizam operações. `provider_id` da identidade Google é um identificador de conta; o `id` interno da identidade Supabase é outro identificador e não deve ser confundido com ele.

Bloqueios:

1. `reviewer_user_id` igual ao `contractor_id`: rejeitar no servidor e na função SQL.
2. A identidade Google do avaliador igual a uma identidade Google vinculada ao usuário proprietário: rejeitar no servidor. O backend pode conferir o proprietário pelo Auth Admin, sem divulgar seus dados; não conceder leitura de `auth.users`/`auth.identities` aos clientes.
3. Conta Google com e-mail confirmado correspondente à conta Auth proprietária ainda não vinculada: bloquear/solicitar resolução de vínculo, sem criar vínculos silenciosos ou usar e-mail público comercial como prova de propriedade.

Supabase pode vincular identidades automaticamente quando o e-mail verificado coincide. Esse comportamento deve ser testado com o login profissional existente. O primeiro critério de propriedade permanece o ID Auth do dono, e não seu nome comercial. Outra conta Google pertencente à mesma pessoa não pode ser reconhecida com certeza apenas pelo OAuth; não prometer essa proteção.

## 3. Migrações SQL propostas, na ordem

Os nomes abaixo são **nomes lógicos**, não versões inventadas de migrations. Após aprovação do desenho, gerar arquivos versionados com `supabase migration new`, auditar e testar localmente; apresentar SQL final, hashes e ordem antes de qualquer aplicação remota.

Dependências existentes: `us_public_profiles_reviews.sql`, `us_marketplace_read_models.sql`, `us_public_review_rate_limit.sql`, Auth, `contractor_profiles`, `admin_users` e auditoria. Não modificar schema gerenciado pelo Supabase Auth.

### Migration 1 — `review_authenticated_identity_foundation`

- Criar `gef_private.review_authenticated_identities`: `review_id`, `contractor_id`, `reviewer_user_id`, `provider` limitado a google, `provider_subject` privado e data.
- Unique `(contractor_id, reviewer_user_id)` e `(contractor_id, provider, provider_subject)` garantem uma avaliação por conta e independência do segredo HMAC de e-mail. O subject Google permanece privado e não depende da branch.
- Relacionamento com `contractor_reviews`; assegurar que `contractor_id` corresponda ao proprietário da avaliação com FK composta e a chave correspondente na tabela de avaliações.
- FK do avaliador para Auth com `ON DELETE SET NULL`; preservar a reserva do subject privado enquanto a avaliação existir. Política de exclusão/anonymização e retenção deve ser definida antes de uso com clientes reais; não apagar ou reter indefinidamente por decisão implícita.
- Tornar `contractor_reviews.identity_hash` opcional para novas avaliações autenticadas, mantendo hashes antigos e sua constraint para os registros legados. Novas avaliações não usam HMAC de e-mail como chave de unicidade.
- RLS habilitado; revogar acesso de PUBLIC, anon e authenticated. Conceder somente os privilégios estritamente necessários a service_role. Não criar policy pública nem expor `gef_private` no Data API.

### Migration 2 — `review_authenticated_submission`

- Nova função `gef_submit_authenticated_review`: recebe ID do usuário e identidade Google exclusivamente do backend confiável, mais conteúdo validado e hash do convite.
- Manter SECURITY INVOKER, `search_path=''`, relações qualificadas e EXECUTE apenas para service_role.
- Trancar o convite com `FOR UPDATE`; verificar validade, uso, publicação e profissional ativo. Rejeitar autoavaliação por ID. Determinar o proprietário e a origem a partir do convite, não do payload.
- Inserir avaliação pending e sua identidade privada, e consumir convite **na mesma transação**. Falha de unicidade/autoavaliação desfaz tudo e não consome o convite. Constraints, não uma consulta prévia isolada, resolvem concorrência entre convites.
- Desativar a assinatura antiga `gef_submit_review(jsonb)` para impedir submissão anônima por deployments anteriores. Preservar uma resposta de falha explícita durante a transição e revisar grants. Não deixar o endpoint antigo contornar a nova autenticação.
- Acrescentar uma função de contexto do convite, server-only, que permite preparar o login sem consumir o convite; sua resposta pública contém somente dados mínimos do profissional e disponibilidade. IDs proprietários permanecem no backend.
- `gef_create_review_invitation`, moderação e auditoria existentes continuam funcionando. Denúncias podem continuar pelo fluxo atual com rate limit; não criar exigência nova de login para denúncias nesta etapa.

### Migration 3 — `review_authenticated_public_reputation`

- Atualizar `gef_public_profile` para projetar avaliações approved **com identidade autenticada registrada** e `review_summary` com `approved_count` e `average_rating`.
- Calcular `COUNT(*)` e `AVG(rating)` sobre todos os registros elegíveis. A lista de até 100 avaliações é somente paginação/apresentação; não limita a média ou contagem.
- Sem avaliações: quantidade 0 e média null; mostrar **No reviews yet**, sem nota artificial. Exibição com uma casa decimal; denominador e soma exatos no banco.
- Aprovar altera o resumo; rejeitar/ocultar retira imediatamente. Pending nunca entra. Resumo e lista usam o mesmo critério de elegibilidade e projeção consistente.
- Índices: aproveitar o índice existente por proprietário/status e medir planos antes de adicionar índices redundantes. Manter RPC server-only e projeção explícita, sem e-mails, Auth IDs, subjects ou hashes.

### Migration 4 — `review_legacy_classification_audit`

- Registrar classificação/rastreabilidade dos registros anteriores como identidade declarada não verificada, com snapshot privado de status se necessário; manter conteúdo, origem e decisões anteriores.
- Não atribuir usuário/identidade Google por nome ou hash de e-mail. Não converter avaliações antigas em verificadas automaticamente.
- Pela proposta, legadas ficam no histórico administrativo e fora da nova reputação/lista pública autenticada, mesmo que já aprovadas. Isso é uma mudança de critério de publicação e requer aprovação explícita.
- Development conhecido possui somente duas avaliações sintéticas, rejected e hidden, e zero approved. Recontar antes de aplicar; se surgirem dados operacionais, parar. Não apagar fixtures ou modificar status silenciosamente.
- Convites antigos ainda válidos e não utilizados permanecem utilizáveis após login. Convites já consumidos não são reabertos. Uma nova avaliação via convite novo poderá ser enviada por conta Google ainda sem reserva autenticada; isso não liga retroativamente a avaliação antiga ao usuário.

## 4. Dependências externas a aprovar

1. Projeto Google Cloud de desenvolvimento e OAuth Client do tipo Web application, separados de produção; usar existente seguro se disponível. Nenhum recurso foi criado nesta etapa.
2. Tela de consentimento/audience em modo de testes, contas Google de teste autorizadas e escopos mínimos `openid`, e-mail e perfil. Usar contas dedicadas de teste: contas Google não são contas fictícias locais e precisam existir no Google. Fluxo OAuth envolve Google externamente, mas não envio de SMS/e-mail pela aplicação.
3. Callback Google exato: `https://cpjsbijgijeyrwjpuciv.supabase.co/auth/v1/callback`. Client ID/Secret cadastrados no provider Google **do Development**, por painel ou mecanismo seguro. Secret não entra no chat, código, browser ou logs.
4. No Supabase, allowlist de retorno contendo apenas o callback exato da origem Preview escolhida, por exemplo `<ORIGEM_PREVIEW_APROVADA>/api/reviews/auth-callback`. Não usar wildcard de todos os deployments, domínio de produção ou URL temporária que mude a cada build.
5. Definir uma origem estável da branch para início e callback. O Preview da #56 está sem configuração exclusiva completa: não iniciar OAuth nele até preflight e isolamento aprovados. Novas variáveis, se necessárias, serão listadas com escopo Preview + branch exata antes de configuração.
6. Novo segredo de criptografia/contexto de cookies, proposto como `GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET`, server-side, independente de produção e do HMAC antigo. Nenhum segredo foi gerado ou configurado agora.
7. Conferir settings/hooks Auth: Google precisa poder criar automaticamente usuários de clientes. O bloqueio do endpoint de cadastro profissional continua ativo. Se Auth estiver com criação global desativada ou hooks exigirem perfil profissional, a exceção deve ser apresentada para aprovação; não habilitar signup global indiscriminadamente.
8. Preservar bloqueio de notificações e inspecionar hooks de criação de usuário: login Google não pode disparar automações de e-mail/SMS ou criar carteira/profissional. Nenhuma alteração automática de SMTP, proteção Vercel ou permissões de Google Cloud.

## 5. Tratamento de implantação e rollback

Implementar código em branch baseada na #56, com novos endpoints inicialmente desativados e preflight fail-closed. Testar SQL e aplicação em sandbox local antes da instalação Development. Após aprovação dos arquivos e configuração externa: aplicar migrations sequenciais no Development, conferir grants/RLS/Advisors, configurar provider e redirects aprovados, publicar somente Preview e habilitar o fluxo de avaliações.

Durante a troca, bloquear temporariamente submissões antigas para evitar janela anônima. A desativação da RPC legada afetará branches antigas que compartilham Development e deve constar da aprovação; convites permanecem preservados. Não ativar o novo fluxo pela metade.

Rollback inicial: desligar apenas o fluxo de avaliações OAuth da branch, limpar cookies incompatíveis e manter novas tabelas/histórico. Não reabrir a RPC anônima, reverter dados, apagar identidades ou reativar publicação legada automaticamente. Qualquer rollback de schema será apresentado separadamente.

## 6. Plano de testes e critérios de aceite

| Grupo | Casos obrigatórios |
| --- | --- |
| Auth | Primeiro Google login cria somente usuário Auth; retorno sem senha/cadastro; cancelamento; sessão expirada; código PKCE repetido/inválido; state/contexto adulterado; logout e troca de conta |
| Convite | Preservado após OAuth; fragmento removido; expirado/inexistente/usado; contexto expirado; convite de outro profissional; nenhuma URL/log contém token |
| Identidade | Token de outro projeto recusado; sessão anônima/password-only recusada para avaliar; usuário Google sem perfil profissional consegue avaliar; IDs/subjects/e-mails enviados no corpo são ignorados |
| Autoavaliação | Mesmo Auth ID; identidade Google vinculada ao dono; conta profissional existente com password e mesmo e-mail confirmado; outra conta legítima avalia normalmente |
| Duplicidade | Mesmo usuário em dois convites e duas requisições simultâneas: uma avaliação; replay após sucesso; rejeição/ocultação não libera segunda; segredo HMAC/alias da branch não altera unicidade |
| Moderação | Pending invisível; aprovação/rejeição/ocultação; motivo obrigatório; auditoria e idempotência existentes; denúncia e resolução preservadas; profissional sem permissão administrativa |
| Reputação | Zero, uma e várias approved; médias conhecidas; pending/rejected/hidden excluídas; mais de 100 registros locais não truncam agregado; legado excluído conforme política aprovada |
| Privacidade/RLS | Nenhum e-mail/subject/Auth ID na projeção, HTML, logs ou analytics; browser sem leitura de tabela privada ou EXECUTE privilegiado; isolamento de Development e grants mínimos |
| UX/acessibilidade | 1440 e 390 px; teclado/leitor de tela; foco após retorno/cancelamento; botão Google acessível; mensagens 401/403/409/429 claras; sem overflow ou pedidos de senha |
| Proteções | SSO Vercel ativo e callback acessível com sessão autorizada; Stripe Checkout desativado, SMS dry_run, leads/entregas bloqueados; zero operações financeiras |

Mocks e bancos locais usam somente identidades sintéticas. O teste OAuth real requer contas Google dedicadas e autorizadas; nenhum cliente real ou mensagem externa será usado. Grandes volumes para cálculo/concorrência ficam no sandbox local. Evidências hospedadas não terão códigos OAuth, cookies, e-mails, subjects ou convites.

O código OAuth chega ao callback pela query string por exigência do protocolo. Limpar a URL após a troca; não registrar URLs de callback completas nos logs da aplicação, analytics ou evidências. Conferir também a retenção/redação de logs gerenciados de acesso da hospedagem antes de afirmar ausência desses códigos em toda a infraestrutura.

## 7. Aprovação solicitada antes de executar

Este plano propõe aprovação em dois passos:

1. Aprovar desenho, quatro migrations lógicas, desativação do envio anônimo e exclusão das legadas da reputação; então preparar implementação e SQL versionado, com testes locais e nova PR draft para revisão.
2. Após revisão de SQL/hashes, aprovar separadamente instalação exclusivamente em Development e configuração do OAuth Google, incluindo client, contas de teste, origem exata, provider e allowlist. Credenciais somente por configuração segura.

Nenhuma dessas ações externas ou de schema foi executada agora. Production, main, Orçamentos Brasil, Stripe e envios permanecem intocados.

## Referências verificadas

- [Supabase — Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google): configuração de client, scopes, callback e fluxo PKCE.
- [Supabase — PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow): troca de código e armazenamento de contexto de autenticação.
- [Supabase — identidades](https://supabase.com/docs/guides/auth/identities): distinção entre usuário, identidade interna e conta do provider.
- [Supabase — identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking): ligação automática e implicações para usuários profissionais existentes.
- [Supabase — redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): allowlist de retorno.
- [Supabase — changelog](https://supabase.com/changelog.md): consultado antes do desenho. Dependências/SDK e mudanças relevantes serão verificadas novamente na implementação.
