# GFDATA-001 - Arquitetura de Métricas Oficiais do GetEstimateFast

Versão: 0.1  
Status: Draft  
Sistema: GF-OS  
Série: GFDATA  
Projeto: GetEstimateFast  
Área: Dados, Analytics e Business Intelligence  

---

## 1. Finalidade

O documento **GFDATA-001 - Arquitetura de Métricas Oficiais do GetEstimateFast** define a estrutura inicial de métricas que deve orientar a análise, o acompanhamento e a tomada de decisão dentro do GetEstimateFast.

Seu objetivo é criar uma linguagem comum para medir aquisição, SEO, mídia paga, produto, conversão, leads, operações, qualidade e crescimento.

A partir deste documento, as métricas deixam de ser números soltos e passam a fazer parte de uma arquitetura organizada, conectada ao GF-OS e às decisões estratégicas da plataforma.

---

## 2. Princípio Central

O GetEstimateFast deve medir aquilo que ajuda a tomar decisão.

Uma métrica oficial precisa responder pelo menos uma das perguntas abaixo:

1. estamos atraindo usuários qualificados?
2. estamos aparecendo nas buscas certas?
3. as páginas estão convertendo?
4. os formulários estão funcionando?
5. os leads recebidos têm qualidade?
6. os serviços certos estão sendo priorizados?
7. as cidades certas estão sendo trabalhadas?
8. os canais pagos estão gerando retorno?
9. as operações estão respondendo com velocidade e qualidade?
10. os dados são confiáveis o suficiente para orientar ação?

---

## 3. Camadas da Arquitetura de Métricas

A arquitetura de métricas do GetEstimateFast será organizada em oito camadas principais:

1. métricas de aquisição;
2. métricas de SEO;
3. métricas de mídia paga;
4. métricas de produto e quote flow;
5. métricas de conversão;
6. métricas de qualidade de leads;
7. métricas operacionais;
8. métricas estratégicas de expansão.

Cada camada deve ter métricas próprias, mas todas devem se conectar à pergunta central:

**O GetEstimateFast está gerando mais leads qualificados, com menor atrito, maior previsibilidade e melhor potencial comercial?**

---

## 4. Métricas de Aquisição

As métricas de aquisição mostram como os usuários chegam ao GetEstimateFast.

### 4.1 Métricas principais

| Métrica | Definição | Uso principal |
|---|---|---|
| Usuários | Quantidade de usuários únicos em determinado período | Medir alcance |
| Sessões | Quantidade total de visitas | Medir volume de navegação |
| Origem / mídia | Canal que trouxe o usuário | Entender aquisição |
| Página de entrada | Primeira página visitada | Identificar portas de entrada |
| Dispositivo | Desktop, mobile ou tablet | Avaliar experiência por dispositivo |
| Localização aproximada | Cidade, região ou país | Avaliar aderência geográfica |
| Novo usuário | Usuário sem visita anterior registrada | Medir descoberta |
| Usuário recorrente | Usuário que já visitou antes | Medir retorno e consideração |

### 4.2 Fontes prováveis

- Google Analytics 4;
- Vercel Analytics, se utilizado;
- Search Console, para aquisição orgânica;
- Google Ads, para aquisição paga.

### 4.3 Decisões apoiadas

Essas métricas ajudam a decidir:

- quais canais merecem mais investimento;
- quais páginas são melhores portas de entrada;
- se o tráfego está vindo da região certa;
- se o site está atraindo usuários móveis;
- se existe dependência excessiva de um único canal.

---

## 5. Métricas de SEO

As métricas de SEO medem a capacidade do GetEstimateFast de aparecer organicamente no Google e atrair tráfego qualificado.

### 5.1 Métricas principais

| Métrica | Definição | Uso principal |
|---|---|---|
| Impressões | Quantas vezes uma página apareceu na busca | Medir visibilidade |
| Cliques orgânicos | Quantos cliques vieram da busca | Medir tráfego orgânico |
| CTR orgânico | Cliques divididos por impressões | Medir força do título e snippet |
| Posição média | Posição média nas buscas | Medir ranqueamento |
| Query | Termo pesquisado pelo usuário | Entender intenção |
| Página ranqueada | URL exibida no Google | Avaliar páginas orgânicas |
| Cluster SEO | Grupo de keywords por tema | Medir estratégia por assunto |
| Indexação | Status de páginas no índice do Google | Garantir presença técnica |
| Páginas em crescimento | URLs com aumento de cliques ou impressões | Identificar oportunidades |
| Páginas em queda | URLs com redução de performance | Priorizar correção |

### 5.2 Clusters prioritários de SEO

Os dados devem ser agrupados por clusters, como:

- roofing;
- plumbing;
- HVAC;
- electrical;
- bathroom remodeling;
- kitchen remodeling;
- flooring;
- painting;
- drywall;
- general contractor;
- permits and compliance;
- storm hardening;
- commercial contractor;
- local service pages.

### 5.3 Decisões apoiadas

Essas métricas ajudam a decidir:

- quais páginas precisam ser atualizadas;
- quais temas devem receber novos artigos;
- quais páginas locais devem ser criadas;
- quais keywords têm potencial de conversão;
- quais clusters estão crescendo;
- quais termos têm impressões, mas poucos cliques;
- quais páginas precisam de melhor título, meta description ou conteúdo.

---

## 6. Métricas de Mídia Paga

As métricas de mídia paga medem o desempenho de campanhas, principalmente Google Ads.

### 6.1 Métricas principais

| Métrica | Definição | Uso principal |
|---|---|---|
| Investimento | Valor gasto no período | Controlar orçamento |
| Impressões pagas | Exibições dos anúncios | Medir alcance pago |
| Cliques pagos | Cliques nos anúncios | Medir tráfego pago |
| CPC | Custo médio por clique | Avaliar custo de aquisição |
| Conversões | Ações valiosas geradas | Medir resultado direto |
| Custo por conversão | Investimento dividido por conversões | Medir eficiência |
| Taxa de conversão paga | Conversões divididas por cliques | Avaliar landing page e oferta |
| Termo de busca | Busca real que acionou o anúncio | Refinar campanha |
| Keyword paga | Palavra-chave configurada | Avaliar segmentação |
| Grupo de anúncio | Agrupamento da campanha | Medir organização |
| Landing page | Página de destino do anúncio | Avaliar aderência e conversão |

### 6.2 Decisões apoiadas

Essas métricas ajudam a decidir:

- quais campanhas devem continuar;
- quais campanhas devem ser pausadas;
- quais keywords negativas devem ser adicionadas;
- quais serviços têm custo aceitável;
- quais cidades geram leads melhores;
- quais landing pages precisam ser ajustadas;
- se a campanha está comprando tráfego certo ou errado.

---

## 7. Métricas de Produto e Quote Flow

As métricas de produto medem como o usuário navega, interage e avança dentro do site e dos formulários.

### 7.1 Métricas principais

| Métrica | Definição | Uso principal |
|---|---|---|
| Início de quote flow | Usuário iniciou formulário | Medir intenção |
| Etapa alcançada | Última etapa preenchida | Identificar fricção |
| Abandono por etapa | Usuário saiu antes de concluir | Encontrar gargalos |
| Conclusão de formulário | Usuário enviou solicitação | Medir conversão |
| Tempo até conclusão | Tempo para terminar o fluxo | Avaliar dificuldade |
| Clique em CTA | Clique em botão principal | Medir força da chamada |
| Clique em telefone | Usuário clicou para ligar | Medir intenção direta |
| Clique em SMS | Usuário clicou para mensagem | Medir canal alternativo |
| Clique em WhatsApp | Usuário clicou para WhatsApp, se aplicável | Medir contato rápido |
| Erro de formulário | Falha técnica ou validação | Corrigir problemas |

### 7.2 Eventos recomendados

Os eventos devem ser padronizados, por exemplo:

| Evento | Significado |
|---|---|
| quote_start | Usuário iniciou o fluxo |
| quote_step_view | Usuário visualizou uma etapa |
| quote_step_complete | Usuário concluiu uma etapa |
| quote_submit | Usuário enviou o formulário |
| quote_abandon | Usuário abandonou o fluxo |
| call_click | Usuário clicou no telefone |
| sms_click | Usuário clicou no SMS |
| whatsapp_click | Usuário clicou no WhatsApp |
| service_select | Usuário selecionou um serviço |
| location_submit | Usuário informou localização |

### 7.3 Decisões apoiadas

Essas métricas ajudam a decidir:

- quais formulários devem ser simplificados;
- quais etapas geram abandono;
- quais serviços precisam de fluxo próprio;
- quais CTAs funcionam melhor;
- se o mobile está prejudicando a conversão;
- se o usuário prefere ligar, mandar SMS ou preencher o formulário.

---

## 8. Métricas de Conversão

As métricas de conversão medem a capacidade do GetEstimateFast de transformar tráfego em ação.

### 8.1 Métricas principais

| Métrica | Definição | Uso principal |
|---|---|---|
| Lead total | Total de solicitações recebidas | Medir volume |
| Conversão total | Total de ações relevantes | Medir resultado geral |
| Taxa de conversão | Conversões divididas por sessões ou usuários | Medir eficiência |
| Conversão por página | Leads por URL | Avaliar páginas |
| Conversão por serviço | Leads por categoria de serviço | Priorizar serviços |
| Conversão por cidade | Leads por localização | Priorizar regiões |
| Conversão por canal | Leads por origem | Avaliar aquisição |
| Conversão por dispositivo | Leads por mobile, desktop ou tablet | Avaliar UX |
| Conversão assistida | Conversão influenciada por visitas anteriores | Entender jornada |

### 8.2 Conversões oficiais iniciais

As conversões oficiais iniciais do GetEstimateFast devem ser:

1. envio de formulário completo;
2. clique em telefone;
3. clique em SMS;
4. clique em WhatsApp, quando aplicável;
5. envio de lead válido para operação;
6. lead qualificado;
7. lead repassado para parceiro;
8. lead com retorno comercial registrado.

### 8.3 Decisões apoiadas

Essas métricas ajudam a decidir:

- quais páginas geram leads;
- quais serviços convertem melhor;
- quais canais devem receber investimento;
- onde existe tráfego sem conversão;
- quais páginas precisam de melhoria de CTA, conteúdo ou formulário.

---

## 9. Métricas de Qualidade de Leads

O GetEstimateFast não deve medir apenas quantidade de leads. A qualidade é essencial para decidir crescimento, mídia paga, SEO e operação.

### 9.1 Classificações principais

| Métrica | Definição | Uso principal |
|---|---|---|
| Lead bruto | Todo lead recebido | Medir volume inicial |
| Lead válido | Lead com contato e serviço utilizáveis | Medir aproveitamento |
| Lead inválido | Lead sem dados úteis ou falso | Medir ruído |
| Lead duplicado | Lead repetido | Evitar contagem inflada |
| Lead fora da área | Lead fora da cobertura | Ajustar segmentação |
| Lead fora do escopo | Serviço não atendido | Ajustar oferta |
| Lead qualificado | Lead com potencial real | Medir valor comercial |
| Lead urgente | Lead com necessidade imediata | Priorizar resposta |
| Lead alto valor | Lead com ticket potencial alto | Priorizar comercialmente |
| Lead residencial | Lead de homeowner ou residência | Segmentar operação |
| Lead comercial | Lead de negócio ou imóvel comercial | Segmentar B2B |

### 9.2 Métricas derivadas

| Métrica | Fórmula |
|---|---|
| Taxa de lead válido | Leads válidos / leads brutos |
| Taxa de lead inválido | Leads inválidos / leads brutos |
| Taxa de lead qualificado | Leads qualificados / leads brutos |
| Taxa de lead fora da área | Leads fora da área / leads brutos |
| Taxa de lead comercial | Leads comerciais / leads brutos |
| Taxa de lead alto valor | Leads alto valor / leads brutos |

### 9.3 Decisões apoiadas

Essas métricas ajudam a decidir:

- se o tráfego comprado está correto;
- se SEO está atraindo público certo;
- se o formulário precisa filtrar melhor;
- quais serviços geram leads melhores;
- quais cidades devem ser priorizadas;
- quais parceiros devem receber determinados leads.

---

## 10. Métricas Operacionais

As métricas operacionais medem o que acontece depois que o lead chega.

### 10.1 Métricas principais

| Métrica | Definição | Uso principal |
|---|---|---|
| Tempo de primeira resposta | Tempo até alguém responder o lead | Medir velocidade |
| Lead contatado | Lead que recebeu tentativa de contato | Medir execução |
| Lead sem resposta | Cliente não respondeu | Medir perda |
| Lead repassado | Lead enviado para parceiro | Medir distribuição |
| Parceiro designado | Profissional indicado | Rastrear destino |
| Status do lead | Etapa atual do lead | Controlar operação |
| SLA cumprido | Lead respondido dentro do prazo | Medir padrão |
| SLA perdido | Lead fora do prazo | Corrigir gargalo |
| Feedback do parceiro | Retorno sobre qualidade | Melhorar classificação |
| Resultado comercial | Fechou, perdeu, pendente ou inválido | Medir valor real |

### 10.2 Status operacionais recomendados

| Status | Significado |
|---|---|
| Novo | Lead recebido |
| Em análise | Lead sendo verificado |
| Válido | Lead aproveitável |
| Inválido | Lead descartado |
| Fora da área | Localização não atendida |
| Fora do escopo | Serviço não atendido |
| Enviado ao parceiro | Lead repassado |
| Contatado | Cliente recebeu contato |
| Aguardando cliente | Sem resposta do cliente |
| Orçamento agendado | Visita ou orçamento marcado |
| Fechado | Serviço vendido |
| Perdido | Não converteu |
| Arquivado | Encerrado sem ação futura |

### 10.3 Decisões apoiadas

Essas métricas ajudam a decidir:

- se a operação está respondendo rápido;
- se os parceiros estão recebendo bons leads;
- se há gargalo entre lead recebido e contato;
- se algum serviço gera leads difíceis de atender;
- se é necessário criar novos parceiros por região ou serviço.

---

## 11. Métricas Estratégicas de Expansão

Essas métricas ajudam a decidir onde o GetEstimateFast deve crescer.

### 11.1 Expansão por serviço

Cada serviço deve ser analisado por:

| Critério | Pergunta |
|---|---|
| Demanda | Existe busca suficiente? |
| Intenção | A busca é comercial ou informacional? |
| Ticket | O serviço tem valor potencial alto? |
| Concorrência | A SERP é muito disputada? |
| Operação | Existe capacidade de atendimento? |
| Conversão | O serviço gera leads? |
| Qualidade | Os leads são bons? |
| Margem | O serviço tende a gerar retorno? |

### 11.2 Expansão por cidade

Cada cidade deve ser analisada por:

| Critério | Pergunta |
|---|---|
| Demanda local | Há buscas com intenção local? |
| Proximidade | Está dentro da área operacional? |
| Concorrência | Há muitos players fortes? |
| Páginas existentes | Já temos página local? |
| Leads atuais | Já recebemos contatos dessa região? |
| Conversão | A cidade converte? |
| Potencial | A região justifica conteúdo e campanhas? |

### 11.3 Decisões apoiadas

Essas métricas ajudam a decidir:

- qual cidade terá próxima landing page;
- qual serviço terá novo cluster SEO;
- qual serviço merece campanha paga;
- qual região precisa de parceiro;
- qual tema deve virar conteúdo educativo;
- qual área deve ser evitada por baixa qualidade de lead.

---

## 12. Métricas Norteadoras

O GetEstimateFast deve ter poucas métricas norteadoras para evitar excesso de acompanhamento.

### 12.1 Métrica principal

A métrica principal recomendada é:

**Leads qualificados por serviço e cidade.**

Essa métrica conecta aquisição, SEO, produto, conversão e operação.

### 12.2 Métricas secundárias

As métricas secundárias recomendadas são:

1. tráfego orgânico qualificado;
2. taxa de conversão por página;
3. custo por lead;
4. taxa de lead válido;
5. tempo de primeira resposta;
6. leads por serviço;
7. leads por cidade;
8. páginas com crescimento orgânico;
9. campanhas com custo aceitável;
10. serviços com maior potencial de expansão.

---

## 13. Padrão de Registro de Métricas

Toda métrica oficial deve ser registrada com o seguinte padrão:

| Campo | Descrição |
|---|---|
| Nome da métrica | Nome oficial |
| Definição | O que ela mede |
| Fórmula | Como é calculada |
| Fonte | De onde vem |
| Frequência | Quando deve ser analisada |
| Dono | Quem acompanha |
| Decisão apoiada | Para que serve |
| Limitações | O que pode distorcer o dado |

### Exemplo

| Campo | Exemplo |
|---|---|
| Nome da métrica | Taxa de lead válido |
| Definição | Percentual de leads recebidos que são utilizáveis |
| Fórmula | Leads válidos / leads brutos |
| Fonte | CRM, planilha operacional ou banco de leads |
| Frequência | Semanal e mensal |
| Dono | Operações / Dados |
| Decisão apoiada | Avaliar qualidade de aquisição e campanhas |
| Limitações | Depende da classificação correta pela operação |

---

## 14. Cadência de Leitura

As métricas devem ser analisadas em três níveis.

### 14.1 Semanal

Objetivo: correção rápida.

Avaliar:

- leads recebidos;
- conversões;
- campanhas ativas;
- páginas com variações fortes;
- problemas técnicos;
- qualidade inicial dos leads.

### 14.2 Mensal

Objetivo: decisão tática.

Avaliar:

- evolução de tráfego;
- crescimento orgânico;
- desempenho por serviço;
- desempenho por cidade;
- custo por lead;
- taxa de lead válido;
- oportunidades de conteúdo;
- campanhas a escalar ou pausar.

### 14.3 Trimestral

Objetivo: decisão estratégica.

Avaliar:

- expansão por cidade;
- expansão por serviço;
- ROI por canal;
- evolução do produto;
- qualidade operacional;
- necessidade de novos dashboards;
- revisão das métricas oficiais.

---

## 15. Relação com Dashboards

A arquitetura de métricas deve orientar a criação dos dashboards oficiais do GetEstimateFast.

Dashboards recomendados:

1. Dashboard Executivo;
2. Dashboard de SEO;
3. Dashboard de Google Ads;
4. Dashboard de Conversão;
5. Dashboard de Leads;
6. Dashboard Operacional;
7. Dashboard de Expansão;
8. Dashboard de Qualidade de Dados.

Cada dashboard deve usar apenas métricas definidas oficialmente ou métricas experimentais claramente identificadas.

---

## 16. Qualidade dos Dados

Toda métrica deve considerar a qualidade dos dados.

Problemas comuns:

- tracking ausente;
- evento duplicado;
- conversão contada duas vezes;
- lead sem origem;
- lead sem cidade;
- lead sem serviço;
- tráfego interno misturado;
- campanha sem UTM;
- classificação manual inconsistente;
- dados de diferentes ferramentas com critérios distintos.

Sempre que houver dúvida, o relatório deve indicar a limitação.

---

## 17. Regras de Governança

A governança das métricas oficiais seguirá estas regras:

1. nenhuma métrica crítica deve existir sem definição;
2. nenhuma métrica deve ser usada em decisão importante sem fonte identificada;
3. métricas podem evoluir, mas mudanças devem ser documentadas;
4. métricas antigas podem ser arquivadas;
5. métricas experimentais devem ser marcadas como experimentais;
6. relatórios devem diferenciar dado, hipótese e recomendação;
7. métricas operacionais dependem de registro disciplinado;
8. dashboards devem evitar excesso de indicadores sem ação clara.

---

## 18. Métricas que Não Devem Guiar Decisão Sozinhas

Algumas métricas podem enganar quando analisadas isoladamente.

Não devem guiar decisão sozinhas:

- visitas totais;
- impressões sem clique;
- cliques sem conversão;
- leads brutos sem qualificação;
- posição média sem análise de query;
- CPC sem qualidade de lead;
- conversão sem análise de origem;
- tráfego sem aderência geográfica;
- volume de conteúdo publicado sem performance;
- número de páginas criadas sem indexação e conversão.

Essas métricas podem ser úteis, mas precisam de contexto.

---

## 19. Critério de Sucesso

A arquitetura de métricas será considerada bem-sucedida quando permitir responder com clareza:

- quais canais trazem usuários qualificados;
- quais páginas geram leads;
- quais serviços têm melhor potencial;
- quais cidades devem ser priorizadas;
- quais campanhas estão desperdiçando dinheiro;
- quais leads têm qualidade;
- onde o usuário abandona o formulário;
- quanto tempo a operação leva para responder;
- quais decisões foram tomadas com base em dados.

---

## 20. Conclusão

O documento **GFDATA-001** cria a base de métricas oficiais do GetEstimateFast.

Ele transforma dados dispersos em uma arquitetura organizada de acompanhamento, análise e decisão.

Com essa estrutura, o GetEstimateFast poderá crescer com mais clareza, reduzir desperdícios, priorizar melhor SEO e mídia paga, melhorar produto e operação, e construir uma cultura de decisão baseada em evidências.
