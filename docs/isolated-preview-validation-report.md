# Relatório da etapa isolada — GetEstimateFast

Entrega: [PR draft #51](https://github.com/cosaqdigital/getestimatefast-v2/pull/51), baseada na branch da [PR #50](https://github.com/cosaqdigital/getestimatefast-v2/pull/50). A branch nova é `feat/isolated-preview-stripe-test-20261009`; as PRs anteriores continuam intactas.

## Implementações

- Auditoria dos seis scripts da #50, com suas dependências, ordem de instalação e permissões, documentada em [provisionamento](isolated-preview-provisioning.md).
- PostgreSQL 17.10 local de múltiplas sessões, efêmero e vinculado somente a loopback. Nenhum dado ou credencial de plataforma foi copiado.
- Bootstrap local executa os seis scripts; o script de bucket é validado contra um schema Storage stub. O serviço Storage continua simulado.
- Preflight de Preview e template de nomes de variáveis, sem secrets; proteção contra backend de produção herdado na nova branch e contra envio de leads/email no ambiente isolado.
- Módulo Stripe test-only com compra individual de contato, serviço de perfil separado, assinatura de webhook, recuperação server-side da sessão, reservas de capacidade e idempotência. [Contrato, travas e pendências](stripe-test-integration.md).
- Correções de UI: mensagem de login concluído e descarte de respostas atrasadas após logout nos painéis profissional e administrativo.
- SQL adicional preparado em `sql/us_stripe_test_checkout.sql`; nenhuma migração foi aplicada em projeto remoto.

## Evidências

Validação final: **60 testes passaram, zero falhas ou skips** em `npm test`. `git diff --check` passou e `npm audit` encontrou zero vulnerabilidades, incluindo dependências de desenvolvimento.

Os testes locais validam API → PostgreSQL → resposta, DOM, cotações, autorização, privacidade, ledger e confirmação Stripe fictícia. Testes de concorrência abrem conexões independentes e verificam que elas aguardam locks em `pg_stat_activity`, eliminando a limitação de sessão única da #50. Casos incluem última vaga, saldo negativo, ajustes/estornos simultâneos, reserva Checkout versus carteira, webhook duplicado, fontes de financiamento e pagamento atrasado após cancelamento/expiração.

Verificação manual no navegador local:

| Área | Resultado |
|---|---|
| Autenticação/dashboard | Login fictício, conta ativa, uma oportunidade, saldo zero e pagamentos desativados |
| Perfil gratuito | Criado e publicado sem consentimento para contatos privados |
| Portfólio | PNG sintético de 1 pixel enviado, salvo e carregado no perfil público |
| Avaliação | Convite exclusivo, envio fictício, estado pendente, moderação administrativa e exibição com origem externa |
| Administração | Login administrativo, indicadores, decisão de moderação e auditoria |
| Mobile | Portal em 390 px; administração e perfil público em 320 px; ausência de transbordamento horizontal nos layouts inspecionados |
| Desktop | Verificação de geometria DOM em 1280 px; captura do painel do navegador tem limitação de área visível e não comprova toda a página larga |

As capturas locais estão em `test-output/public-profile-mobile.jpg` e `test-output/public-profile-desktop.jpg`, ignoradas pelo Git. A captura full-page não foi suportada; foi utilizada captura normal do viewport. Não foram enviados links por WhatsApp/SMS/email, nem publicados dados em sites externos. Auth/Supabase Storage reais não foram usados nesses testes de navegador.

## Limitações e próximos passos

1. Nenhum Supabase exclusivo está disponível; provisionar exige organização/custo e autorização para criar o recurso. Os projetos existentes foram apenas listados, sem consultas de dados nesta etapa.
2. A conexão Vercel não encontra o projeto/time correspondente; restaurar acesso antes de configurar secrets ou variáveis. Não há alegação de ambiente hospedado integralmente pronto.
3. Instalar/revisar as migrações somente no projeto novo, executar advisors, validar Auth, PostgREST e Storage completos. Testar callbacks, upload/permissões e confirmação de e-mail sem mensagens a terceiros.
4. Não houve chamada ao Stripe Sandbox remoto. Configurar seus secrets posteriormente pelo painel autorizado; manter aprovação test-checkout desativada até decisão comercial.
5. Fotos públicas consentidas não têm remoção de EXIF/transcodificação. Despublicar o perfil não remove um objeto já público no Storage; definir exclusão/retenção antes de uso com dados reais.
6. Contatos seguem bloqueados, recargas não são oferecidas e refunds Stripe são apenas estados sintéticos internos. Fulfillment real exige cobertura/consentimento, reconciliação e política comercial.

Main, produção, Orçamentos Brasil e as PRs #47–#50 foram preservados. Não houve merge, SMS real, envio de e-mail externo, cobrança real ou migração financeira remota.
