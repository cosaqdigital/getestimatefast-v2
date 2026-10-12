# Validação de responsividade dos perfis públicos

Branch: feat/public-profile-responsive-20261011, baseada no commit da PR draft #57. Ambiente permitido: Vercel Preview do projeto getestimatefast-v2 e backend Development cpjsbijgijeyrwjpuciv, somente leitura.

## Causa e correção

No Preview anterior, a 390 px, o parágrafo de comentário da avaliação, dentro de article.card, contém um texto de 45 caracteres cuja linha alcança 445 px. O card termina em 359 px e o parágrafo em 340 px; o texto excede seus limites porque overflow-wrap é normal. Medição por Range.getClientRects confirma que a causa é o texto, não a imagem ou o formulário de compartilhamento. Overflow total: 55 px.

O CSS permite quebra de palavras longas com overflow-wrap:anywhere, preservando o conteúdo. Containers e filhos de grid podem encolher; botões quebram texto, têm largura máxima de 100% e altura mínima de 44 px; controles não ultrapassam o container; o campo de compartilhamento ocupa sua própria linha; o diálogo de denúncia tem largura limitada ao viewport. Botões primários de compartilhamento/contato usam a cor de contraste já adotada nas avaliações. Não foi usado overflow-x:hidden, truncamento de comentários ou remoção de conteúdo.

A lista de branches de Preview recebe apenas a nova branch para permitir o preflight de isolamento. Não há mudança nas regras de Auth, identidade Google, unicidade, autoavaliação ou moderação. Nenhuma alteração de banco foi preparada ou aplicada.

## Verificação inicial local

| Largura | Perfil com textos longos | Formulário Google | Moderação | Overflow |
|---|---|---|---|---|
| 320 px | aprovado | aprovado | aprovado | 0 px |
| 375 px | aprovado | aprovado | aprovado | 0 px |
| 390 px | aprovado | aprovado | aprovado | 0 px |
| 430 px | aprovado | aprovado | aprovado | 0 px |

Verificações incluem diálogo de denúncia, retorno do foco, rótulos, navegação por teclado, outline de foco, mensagens longas de erro e preservação integral dos textos. Zero exceções JavaScript nos cenários testados. O executor scripts/validate-responsive-pages.js usa fixtures interceptadas no navegador para avaliações e administração; nunca grava no Supabase nem autentica contas Google reais.

## Preview hospedado

Resultados finais, origem exata, commit e evidências serão adicionados após a criação do Preview isolado. Nenhuma conclusão de backend hospedado é inferida a partir dos testes locais.

Production, main, Orçamentos Brasil e o Preview da PR #57 permanecem intactos. Sem merge, envio externo, pagamento ou alteração de configuração Supabase/OAuth.
