# Fase 2 — validação funcional hospedada

Data: 10/10/2026, America/New_York. Continuação da PR draft #54, baseada na #53.

## Identidade, isolamento e configuração

Supabase exclusivo: getestimatefast-development, `cpjsbijgijeyrwjpuciv`. Vercel: getestimatefast-v2, `prj_kA6x5rt1MChiNSQpa6pShHoUSuOF`. Nunca foram consultados dados ou credenciais do Supabase Production.

A primeira rodada ocorreu em `feat/hosted-preview-validation-20261010`, SHA `234f5f455f46b0b753963a70284bcea6ea31518f`, deployment `dpl_H77DsawDKZavgus4UmpF1HRoDft4`: https://getestimatefast-v2-vdqew8eur-get-estimate-fast.vercel.app.

Antes de ativar, o executor confirmou preflight válido, acesso administrativo exclusivamente ao Development, duas identidades profissionais sintéticas e cadastro público/envio de leads bloqueados com HTTP 503. O SMS provider não possui método de envio; não foram criadas rodadas de notificações. Os únicos triggers de aplicação observados nas tabelas preparadas registram histórico interno de ativação. Dados e chamadas foram limitados ao Development e à origem Preview autenticada por OIDC.

As alterações foram apresentadas antes da execução. Na branch inicial, foram criados três overrides Config: CONTRACTOR_PROFILE_EDITING_ENABLED=true, CONTRACTOR_SIGNUP_ENABLED=false e LEAD_PERSISTENCE_ENABLED=false. GETESTIMATEFAST_MARKETPLACE_PREVIEW foi atualizado para true somente no registro da branch, depois da preparação dos pedidos. SMS dry_run, Stripe test e Checkout false foram preservados. O redeploy foi explicitamente Preview e preservou branch/SHA; preflight HTTP 200, ready=true.

Para validar a correção sem modificar a PR #53 ou a #54, foi criada `feat/preview-phase2-validation-20261010`, baseada na #54. Sua configuração isolada foi apresentada separadamente antes da execução: 14 novos registros, exclusivamente Preview + essa branch, sem force, upsert ou substituição de registros existentes.

Preview final efetivamente validado: **https://getestimatefast-v2-one1rd8id-get-estimate-fast.vercel.app**, deployment `dpl_ARLZ5epnVfNvdPYocAcxYPcctnBX`, READY/Preview, branch `feat/preview-phase2-validation-20261010`, SHA de código `52ddee96d43b864bfbff429cec848c2ff48a1e60`. Preflight autenticado HTTP 200, ready=true, marketplace=true e Checkout=false. O commit posterior acrescenta somente este relatório; não confundir um deployment automático posterior de documentação com o deployment acima que recebeu os testes completos.

| Variável | Tipo | Valor ou origem autorizada |
|---|---|---|
| GETESTIMATEFAST_SUPABASE_URL | Config | https://cpjsbijgijeyrwjpuciv.supabase.co |
| GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY | Config | Chave publicável exclusivamente Development; valor omitido |
| GETESTIMATEFAST_SUPABASE_SECRET_KEY | Secret | Chave sb_secret_ exclusivamente Development; valor omitido |
| GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF | Config | cpjsbijgijeyrwjpuciv |
| GETESTIMATEFAST_ISOLATED_BACKEND | Config | true |
| GETESTIMATEFAST_SMS_MODE | Config | dry_run |
| GETESTIMATEFAST_STRIPE_MODE | Config | test |
| GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED | Config | false |
| CONTRACTOR_PROFILE_EDITING_ENABLED | Config | true |
| CONTRACTOR_SIGNUP_ENABLED | Config | false |
| LEAD_PERSISTENCE_ENABLED | Config | false |
| GETESTIMATEFAST_PUBLIC_ORIGIN | Config | https://getestimatefast-v2-git-feat-preview-ph-01bd12-get-estimate-fast.vercel.app |
| GETESTIMATEFAST_REVIEW_IDENTITY_SECRET | Secret | CSPRNG independente, 48 bytes; valor omitido |
| GETESTIMATEFAST_MARKETPLACE_PREVIEW | Config | true, configurado por último |

Chaves e tokens foram obtidos e transmitidos apenas em memória/stdin, sem argumentos de credenciais, logs de valores ou arquivos de secrets. Senhas somente das contas sintéticas existentes foram redefinidas administrativamente para a execução; não são recuperáveis pelo relatório. Não foram usados signup, invite ou endpoints administrativos públicos.

## Pedidos, preços e privacidade

Foram criados dois pedidos completos, fictícios, com source=synthetic-preview-phase2 e detalhes explicitamente sintéticos. Os fluxos hospedados admin/approve-lead e admin/publish-opportunity foram utilizados, sem publicação/distribuição de contatos.

| Categoria | Cidade | ZIP Code | Preço simulado | Limite de compradores |
|---|---|---|---|---|
| Painting | Riverview, FL | 33569 | USD 1234 centavos / US$ 12,34 | 1 |
| House Cleaning | Brandon, FL | 33511 | USD 1234 centavos / US$ 12,34 | 1 |

As regras são revisões sintéticas, com validade de oportunidade de 24 horas e sem descontos. Não representam preços comerciais aprovados. A primeira tentativa de preço foi corretamente rejeitada porque o executor omitiu currency=USD; não criou regra. O payload foi corrigido sem duplicar pedidos ou alterar schema.

Cada profissional recebeu somente sua categoria. Filtros positivos/negativos por cidade, categoria, ZIP e raio passaram pela API; Miami/33101 não ampliou a cobertura aprovada. As respostas projetam somente opportunity_id, categoria, resumo público, cidade, ZIP, publicação e preço. Telefone, e-mail, nome e detalhes privados do cliente não foram retornados. Cards renderizaram o resumo e US$ 12,34; não existe nesta entrega um fluxo habilitado de liberação de contatos ou checkout de compra pela interface.

## Perfis e Storage

Os dois profissionais criaram e editaram seus perfis públicos gratuitos pelo formulário real no navegador, com nomes/headlines/about explicitamente SYNTHETIC. A edição das informações comerciais privadas também foi realizada pelo formulário da conta. A API pública confirmou as alterações e manteve public_email/public_phone nulos, sem derivar contatos privados do cadastro.

Uploads reais pelo formulário geraram duas imagens PNG sintéticas via canvas, contendo somente texto de teste e cores. Upload HTTP 201, leitura Storage HTTP 200 e imagem renderizada no navegador. Não foram usadas fotos, faces, endereços ou dados pessoais. Dados inválidos de imagem retornaram HTTP 400. Uso de imagem pertencente ao outro profissional foi rejeitado com HTTP 503; a negação protege a propriedade, mas o status genérico de erro de banco pode ser refinado futuramente para um erro de validação explícito.

As páginas /professionals/synthetic-phase2-professional-1 e /professionals/synthetic-phase2-professional-2 foram visualizadas somente no Preview protegido. Sem OIDC, a Vercel respondeu HTTP 302 para autenticação. Os perfis usam noindex,nofollow e metadados/canonical apontando à origem Preview. Não foram divulgados links nem acionados WhatsApp, SMS, Facebook ou e-mail.

O bucket gef-portfolio é público por desenho: as imagens sintéticas podem ser acessadas diretamente pelo endereço Storage. A proteção SSO cobre as páginas Vercel, não torna esse bucket privado. Somente conteúdo sintético foi publicado nele. Não enviar dados privados nesse bucket; não foi alterada sua configuração.

## Carteira e operações internas sintéticas

O mecanismo financeiro foi chamado exclusivamente por executor privilegiado local com a chave Development, usando as RPCs existentes. As rotas HTTP de compra/crédito/refund permanecem bloqueadas; nenhuma chamada Stripe, depósito ou pagamento externo ocorreu.

Para testar concorrência na mesma oportunidade sem emitir uma quote fora da categoria permitida, o segundo perfil sintético recebeu temporariamente Painting além de House Cleaning. Após o teste, foi restaurado para House Cleaning. As verificações de exclusividade por categoria ocorreram antes e depois dessa alteração controlada.

| Teste | Resultado remoto |
|---|---|
| Carteiras vazias / saldo insuficiente | Ambas rejeitaram a compra, sem débito parcial |
| Crédito sintético pago + bônus | 1000 centavos paid e 400 promotional por profissional |
| Repetição de crédito com a mesma chave | Retornou created=false, sem duplicar saldo |
| Dois profissionais disputando limite de um comprador | Uma compra de 1234 centavos; outra rejeitada por Buyer limit reached |
| Mesma compra/chave repetida | created=false, sem novo débito |
| Outra chave para contato já adquirido | Rejeitada como Contact already purchased |
| Dois estornos simultâneos, mesma chave | Um crédito; segunda resposta idempotente |
| Ajuste negativo superior ao saldo do bucket | Insufficient bucket balance; rollback confirmado |
| Extrato e histórico | Débitos separados por origem e compra marcada refunded |

Estado final: uma compra sintética já estornada, sete entradas de ledger e saldo disponível de 1400 centavos / US$ 14,00 para cada profissional. O comprador Painting ficou com paid=166, promotional=0, refund=1234. House Cleaning ficou com paid=1000, promotional=400, refund=0. Nenhum desses créditos representa dinheiro recebido. O serviço de criação de perfil permanece gratuito no modo self-service e com pagamento separado desativado; não houve débito de carteira para esse serviço.

## Desktop/mobile, falha e correções

Foram testados os dois profissionais em 1440 x 900 e 390 x 900: dashboard, filtros, preço, carteira/extrato, histórico, edição e perfil público com imagens. Zero erros JavaScript. A rodada inicial detectou overflow horizontal somente no profissional com histórico de compra em 390 px. O container purchaseHistory não tinha contenção de tabela; paymentHistory também estava sem essa proteção.

Correção: os dois containers receberam class=table-wrap, usando o overflow interno já definido no CSS. O histórico continua legível por rolagem dentro da tabela, sem alargar a página. Não foi escondido conteúdo nem reduzida a fonte.

A correção foi validada no Preview final com assets realmente hospedados, sem injeção de código local no navegador. Nas quatro combinações de profissional/largura, dashboard_horizontal_overflow=false, public_horizontal_overflow=false e page_errors=0. Confirmou-se overflow-x=auto nos dois containers, filtros de categoria/ZIP/raio pelo formulário, preço US$ 12,34, saldo US$ 14,00 e imagem pública carregada. Sem OIDC, o perfil continuou retornando HTTP 302. Escrita direta no Storage com sessão de profissional retornou HTTP 400 e não criou objetos adicionais; este status isolado não é usado como prova do motivo RLS, que foi conferido separadamente no banco.

A revisão também identificou que as novas branches das PRs de validação não estavam na lista de protectedPreview. Ambas foram incluídas para recusar backend herdado incompatível, bloquear entregas públicas antes de chamadas externas e exigir preflight. Nenhuma variável de branches anteriores foi alterada por essa correção de código.

Validação local: npm test, 65 aprovados/zero falhas (63,4 segundos), incluindo concorrência SQL e Stripe com transporte sintético. Depois da alteração final da tabela: cinco testes direcionados de DOM e segurança passaram. git diff --check passou. Essas verificações locais são distintas da evidência financeira remota acima.

As evidências de navegador ficam em %TEMP%/gef-phase2-*.png; os resultados sanitizados em gef-phase2-results.json. Não foram salvos cookies, HAR, traces ou storageState. OIDC foi enviado somente à origem Preview; requests de imagem ao Storage Development não receberam OIDC.

Evidências finais da correção: %TEMP%/gef-phase2-fixed-dashboard-{0,1}-{1440,390}.png, gef-phase2-fixed-history-{0,1}-{1440,390}.png e gef-phase2-fixed-public-{0,1}-{1440,390}.png. Resultados sanitizados: gef-phase2-fixed-results.json. Capturas mobile do histórico e desktop do dashboard foram novamente inspecionadas visualmente.

## Segurança e pendências

Após as fixtures: dois leads, duas oportunidades, dois perfis públicos, dois objetos Storage, uma compra estornada e sete entradas de ledger. Zero tabelas de aplicação com RLS desligado. Nenhuma migração ou alteração de schema foi aplicada.

Depois da validação final: permanecem três usuários Auth e exatamente dois objetos Storage; storage.objects com RLS ativo; zero funções gef_* executáveis por anon/authenticated. Cadastro público, envio público de lead, compra HTTP e Stripe Checkout HTTP retornaram 503 no Preview corrigido. Os 14 nomes/tipos/escopos de ambiente foram conferidos sem revelar valores secretos.

Security Advisor: zero ERROR, um WARN auth_leaked_password_protection e 28 ocorrências INFO rls_enabled_no_policy, coerentes com acesso privado pelo backend. Não abrir grants ou policies públicas para remover esses avisos INFO.

Recomendação, sem alteração automática: no Auth do projeto Development, usar senha mínima de pelo menos 12 caracteres, exigência de letras maiúsculas/minúsculas, números e símbolos, e habilitar a proteção de senhas vazadas se disponível. A documentação informa que esta proteção exige plano Pro ou superior; eventual mudança de plano precisa de decisão do responsável. Senhas sintéticas desta execução foram geradas criptograficamente. Referência: https://supabase.com/docs/guides/auth/password-security.

Pendências: aprovação do modelo comercial, revisão das regras/preços definitivos, secrets Stripe Sandbox e webhook assinado, validação de Checkout de teste em etapa própria, e revisão de UX/status de erro para foto de terceiro. Avaliações/moderação não foram exercitadas nesta fase. Não foram criadas avaliações falsas.

Sem alterações em main, Production, Supabase Production ou Orçamentos Brasil; sem merge, SMS, e-mails, notificações ou cobranças. SSO permanece ativo.
