# GFDATA-005 - Modelo Oficial de Dashboard Google Ads do GetEstimateFast

Versão: 0.1  
Status: Draft  
Sistema: GF-OS  
Série: GFDATA  
Projeto: GetEstimateFast  
Área: Dados, Analytics e Business Intelligence  

---

## 1. Finalidade

O documento **GFDATA-005 - Modelo Oficial de Dashboard Google Ads do GetEstimateFast** define o padrão oficial para acompanhar, analisar e tomar decisões sobre campanhas pagas do GetEstimateFast.

Seu objetivo é transformar os dados de Google Ads em inteligência prática para controlar orçamento, reduzir desperdício, melhorar conversões, qualificar leads e priorizar serviços e cidades com maior retorno.

---

## 2. Objetivo Central

O Dashboard Google Ads deve responder:

**O investimento em mídia paga está gerando leads qualificados com custo aceitável e potencial comercial real?**

Ele deve permitir identificar:

- campanhas com bom desempenho;
- campanhas desperdiçando orçamento;
- keywords caras sem conversão;
- termos de busca irrelevantes;
- serviços com melhor custo por lead;
- cidades com maior retorno;
- landing pages com baixa conversão;
- leads pagos válidos, inválidos e qualificados.

---

## 3. Fontes de Dados

As fontes principais serão:

- Google Ads;
- Google Analytics 4;
- Google Tag Manager, se utilizado;
- eventos definidos em GFDATA-002;
- dados internos de leads;
- CRM ou planilha operacional;
- relatórios de qualidade de leads;
- dados financeiros futuros.

---

## 4. KPIs Principais

| KPI | Objetivo |
|---|---|
| Investimento | Controlar gasto |
| Impressões | Medir alcance pago |
| Cliques | Medir tráfego pago |
| CPC médio | Medir custo do clique |
| CTR pago | Medir atratividade do anúncio |
| Conversões | Medir ações geradas |
| Taxa de conversão | Medir eficiência da landing page |
| CPA | Medir custo por conversão |
| Leads válidos pagos | Medir qualidade real |
| Leads qualificados pagos | Medir retorno comercial |
| Custo por lead qualificado | Medir eficiência real |
| Termos negativos adicionados | Medir limpeza da campanha |

---

## 5. Visão Geral do Dashboard

A primeira tela deve mostrar:

- investimento total;
- cliques;
- CPC médio;
- conversões;
- CPA;
- leads válidos;
- leads qualificados;
- custo por lead qualificado;
- campanhas em crescimento;
- campanhas críticas;
- serviços com melhor retorno;
- cidades com melhor retorno.

---

## 6. Análise por Campanha

Cada campanha deve ser analisada individualmente.

| Métrica | Uso |
|---|---|
| Nome da campanha | Identificação |
| Serviço | Categoria principal |
| Cidade ou região | Segmentação |
| Investimento | Gasto total |
| Cliques | Volume de tráfego |
| CPC | Custo médio |
| Conversões | Resultado direto |
| CPA | Eficiência |
| Leads válidos | Qualidade inicial |
| Leads qualificados | Valor comercial |
| Status | Escalar, manter, otimizar ou pausar |

### 6.1 Classificação da campanha

| Status | Significado |
|---|---|
| Escalar | Bom volume, bom custo e leads qualificados |
| Manter | Performance aceitável |
| Otimizar | Tem potencial, mas precisa ajustes |
| Pausar | Custo alto e baixa qualidade |
| Teste | Ainda sem dados suficientes |

---

## 7. Análise por Grupo de Anúncio

O dashboard deve medir grupos de anúncio para identificar desalinhamento entre keyword, anúncio e landing page.

| Métrica | Uso |
|---|---|
| Grupo de anúncio | Organização da campanha |
| Tema | Serviço ou intenção |
| Cliques | Volume |
| CPC | Custo |
| CTR | Relevância do anúncio |
| Conversões | Resultado |
| CPA | Eficiência |
| Termos irrelevantes | Necessidade de negativação |
| Landing page | Aderência da página |

---

## 8. Análise por Keyword

As keywords devem ser avaliadas não apenas por cliques, mas por qualidade de lead.

| Métrica | Uso |
|---|---|
| Keyword | Palavra configurada |
| Match type | Broad, phrase ou exact |
| Impressões | Alcance |
| Cliques | Tráfego |
| CPC | Custo |
| CTR | Atração |
| Conversões | Resultado |
| CPA | Eficiência |
| Lead válido | Qualidade |
| Lead qualificado | Valor |
| Decisão | Escalar, ajustar, negativar ou pausar |

---

## 9. Análise por Termo de Busca

O relatório de termos de busca é essencial para evitar desperdício.

### 9.1 O dashboard deve mostrar

- termos que geraram conversão;
- termos caros sem conversão;
- termos irrelevantes;
- termos fora da área;
- termos fora do escopo;
- termos com intenção informacional;
- termos com intenção transacional;
- termos que devem virar keywords exatas;
- termos que devem ser negativados.

### 9.2 Classificação recomendada

| Classificação | Ação |
|---|---|
| Alta intenção | Manter ou escalar |
| Boa intenção | Monitorar |
| Informacional | Avaliar se vale campanha |
| Irrelevante | Negativar |
| Fora da área | Negativar ou ajustar localização |
| Fora do escopo | Negativar |
| Muito genérico | Restringir match type |
| Alto custo sem lead | Pausar ou ajustar lance |

---

## 10. Análise por Serviço

O dashboard deve mostrar performance paga por serviço.

Serviços iniciais:

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
- drainage;
- foundation repair;
- concrete;
- impact windows;
- generator installation;
- commercial contractor.

### 10.1 Métricas por serviço

| Métrica | Uso |
|---|---|
| Investimento | Quanto foi gasto no serviço |
| Cliques | Tráfego pago |
| CPC | Custo médio |
| Conversões | Resultado |
| CPA | Eficiência |
| Leads válidos | Qualidade |
| Leads qualificados | Valor |
| Custo por lead qualificado | Eficiência real |
| Ticket estimado | Potencial comercial |
| Decisão | Escalar, manter, otimizar ou pausar |

---

## 11. Análise por Cidade

O dashboard deve medir campanhas por localização.

Cidades iniciais:

- Riverview;
- Brandon;
- Valrico;
- Gibsonton;
- Apollo Beach;
- Lithia;
- Fish Hawk;
- Ruskin;
- Sun City Center;
- Wimauma;
- Tampa;
- Tampa Bay;
- Hillsborough County.

### 11.1 Métricas por cidade

| Métrica | Uso |
|---|---|
| Investimento | Gasto por região |
| Cliques | Interesse local |
| CPC | Custo local |
| Conversões | Resultado |
| CPA | Eficiência local |
| Leads válidos | Qualidade local |
| Leads fora da área | Problema de segmentação |
| Serviços mais fortes | Priorização |
| Decisão | Escalar, ajustar ou excluir |

---

## 12. Análise por Landing Page

Campanhas pagas dependem diretamente da qualidade da página de destino.

| Métrica | Uso |
|---|---|
| URL | Página analisada |
| Campanha relacionada | Origem |
| Cliques pagos | Volume |
| Conversões | Resultado |
| Taxa de conversão | Eficiência |
| CPA | Custo |
| Bounce ou engajamento | Qualidade da visita |
| Serviço | Aderência |
| Cidade | Aderência local |
| Status | Boa, otimizar ou substituir |

### 12.1 Possíveis problemas

- página genérica demais;
- CTA fraco;
- formulário longo;
- falta de telefone;
- falta de prova local;
- baixa velocidade;
- layout ruim no mobile;
- promessa desalinhada com anúncio;
- serviço diferente da keyword;
- cidade diferente da busca.

---

## 13. Conversões Oficiais

As conversões devem seguir o modelo definido em GFDATA-002.

### 13.1 Conversões principais

- `quote_submit`;
- `thank_you_view`;
- `qualified_lead_created`, quando disponível;
- `partner_lead_sent`, quando disponível.

### 13.2 Conversões secundárias

- `call_click`;
- `sms_click`;
- `whatsapp_click`;
- `quote_start`;
- `quote_step_complete`.

### 13.3 Regra de maturidade

A otimização deve evoluir assim:

1. clique;
2. formulário enviado;
3. lead válido;
4. lead qualificado;
5. lead com resultado comercial.

---

## 14. Qualidade dos Leads Pagos

O dashboard deve separar leads pagos por qualidade.

| Categoria | Significado |
|---|---|
| Lead bruto pago | Todo lead vindo de campanha |
| Lead válido pago | Lead aproveitável |
| Lead inválido pago | Lead ruim ou falso |
| Lead fora da área | Segmentação falhou |
| Lead fora do escopo | Palavra ou anúncio desalinhado |
| Lead qualificado pago | Lead com valor comercial |
| Lead alto valor pago | Lead de ticket potencial alto |

### 14.1 Métricas derivadas

| Métrica | Fórmula |
|---|---|
| Taxa de lead válido pago | Leads válidos pagos / leads pagos brutos |
| Taxa de lead qualificado pago | Leads qualificados pagos / leads pagos brutos |
| Custo por lead válido | Investimento / leads válidos pagos |
| Custo por lead qualificado | Investimento / leads qualificados pagos |
| Taxa de lead inválido pago | Leads inválidos pagos / leads pagos brutos |

---

## 15. Alertas do Dashboard Google Ads

O dashboard deve destacar alertas como:

| Alerta | Significado |
|---|---|
| CPA alto | Campanha ficando cara |
| CPC alto | Keyword competitiva ou mal configurada |
| CTR baixo | Anúncio fraco ou público errado |
| Conversão baixa | Landing page ou intenção ruim |
| Lead inválido alto | Campanha atraindo público errado |
| Termos irrelevantes | Necessidade de negativas |
| Gasto sem lead | Orçamento desperdiçado |
| Cidade ruim | Segmentação local fraca |
| Serviço caro | Verificar ticket e margem |
| Campanha sem tracking | Dados não confiáveis |

---

## 16. Regras de Decisão

### 16.1 Escalar

Uma campanha pode ser escalada quando:

- gera leads válidos;
- CPA está aceitável;
- serviço tem bom ticket;
- cidade está dentro da área;
- landing page converte;
- tracking está confiável.

### 16.2 Otimizar

Uma campanha deve ser otimizada quando:

- gera cliques, mas poucas conversões;
- tem CTR baixo;
- tem CPC alto;
- traz leads parcialmente bons;
- possui termos irrelevantes;
- landing page tem fricção.

### 16.3 Pausar

Uma campanha deve ser pausada quando:

- gasta sem conversão;
- gera leads inválidos;
- atrai público fora da área;
- não tem tracking confiável;
- o serviço não tem operação disponível;
- o custo supera o potencial comercial.

---

## 17. Frequência de Leitura

| Frequência | Objetivo |
|---|---|
| Diário | Evitar desperdício e identificar falhas |
| Semanal | Ajustar keywords, anúncios e orçamento |
| Mensal | Decidir escala, pausa e redistribuição |
| Trimestral | Revisar estratégia paga por serviço e cidade |

---

## 18. Relatórios Derivados

O Dashboard Google Ads deve alimentar:

- relatório semanal de campanhas;
- relatório de termos negativos;
- relatório de custo por lead;
- relatório de qualidade de lead pago;
- relatório por serviço;
- relatório por cidade;
- relatório de landing pages;
- relatório de oportunidades de escala.

---

## 19. Relação com GFSEO

Os dados pagos podem revelar oportunidades orgânicas.

Exemplos:

- termos pagos que convertem podem virar páginas SEO;
- serviços caros em Ads podem justificar SEO orgânico;
- cidades com bom CPA podem receber páginas locais;
- queries caras podem virar guias ou comparativos;
- termos irrelevantes podem orientar conteúdo de filtro.

---

## 20. Relação com GFPROD

Quando campanha gera clique, mas não converte, o problema pode estar no produto ou na landing page.

O dashboard deve sinalizar páginas que precisam de:

- CTA melhor;
- formulário mais simples;
- prova de confiança;
- telefone mais visível;
- copy mais direta;
- melhor mobile UX;
- melhor alinhamento entre anúncio e página.

---

## 21. Relação com GFOPS

A operação deve informar se o lead pago é realmente bom.

Sem feedback operacional, o Google Ads pode otimizar para volume ruim.

GFOPS deve ajudar a responder:

- o lead pago era válido?
- estava dentro da área?
- era serviço atendido?
- tinha urgência real?
- tinha potencial comercial?
- foi contatado?
- virou orçamento?
- virou serviço fechado?

---

## 22. Critério de Sucesso

O Dashboard Google Ads será considerado bem-sucedido quando permitir responder:

- quanto foi gasto;
- quantos leads foram gerados;
- quanto custou cada lead;
- quais campanhas prestam;
- quais campanhas desperdiçam dinheiro;
- quais keywords devem ser pausadas;
- quais termos devem ser negativados;
- quais serviços merecem orçamento;
- quais cidades têm melhor retorno;
- quais leads pagos são realmente qualificados.

---

## 23. Conclusão

O **GFDATA-005** define o modelo oficial de Dashboard Google Ads do GetEstimateFast.

Ele garante que mídia paga seja analisada além de cliques e conversões superficiais.

Com este dashboard, o GetEstimateFast poderá controlar melhor o orçamento, reduzir desperdício, melhorar campanhas, identificar serviços rentáveis, priorizar cidades certas e conectar investimento pago à qualidade real dos leads.
