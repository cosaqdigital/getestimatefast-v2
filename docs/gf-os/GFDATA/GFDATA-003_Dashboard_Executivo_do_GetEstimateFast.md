# GFDATA-003 - Dashboard Executivo do GetEstimateFast

Versão: 0.1  
Status: Draft  
Sistema: GF-OS  
Série: GFDATA  
Projeto: GetEstimateFast  
Área: Dados, Analytics e Business Intelligence  

---

## 1. Finalidade

O documento **GFDATA-003 - Dashboard Executivo do GetEstimateFast** define o padrão oficial para construção dos dashboards executivos da plataforma.

Seu objetivo é transformar dados operacionais em informações estratégicas que apoiem decisões rápidas, consistentes e orientadas por evidências.

O Dashboard Executivo não substitui relatórios detalhados. Seu papel é fornecer uma visão consolidada do desempenho do negócio em poucos minutos.

---

## 2. Objetivos

O Dashboard Executivo deve permitir responder rapidamente às seguintes perguntas:

- O tráfego está crescendo?
- Estamos gerando mais leads?
- Os leads têm qualidade?
- Quais serviços performam melhor?
- Quais cidades apresentam maior potencial?
- As campanhas pagas estão gerando retorno?
- O SEO está evoluindo?
- A operação consegue atender a demanda?
- Existe algum indicador crítico que exige ação imediata?

---

## 3. Princípios

O Dashboard Executivo deve seguir cinco princípios fundamentais:

### 3.1 Clareza

Os indicadores precisam ser compreendidos rapidamente.

### 3.2 Objetividade

Mostrar apenas informações úteis para tomada de decisão.

### 3.3 Comparabilidade

Todos os indicadores devem permitir comparação entre períodos.

### 3.4 Ação

Cada métrica deve sugerir uma possível decisão.

### 3.5 Confiabilidade

Os dados devem vir exclusivamente das métricas oficiais definidas em GFDATA-001 e dos eventos definidos em GFDATA-002.

---

## 4. Estrutura Geral

O Dashboard Executivo será dividido em oito áreas.

### 4.1 Visão Geral

Indicadores:

- usuários;
- sessões;
- leads;
- leads qualificados;
- conversões;
- receita estimada futura;
- crescimento mensal;
- crescimento anual.

### 4.2 Aquisição

Indicadores:

- tráfego orgânico;
- tráfego pago;
- tráfego direto;
- referral;
- social;
- email;
- outros.

Gráficos:

- evolução diária;
- evolução semanal;
- evolução mensal.

### 4.3 SEO

Indicadores:

- impressões;
- cliques;
- CTR;
- posição média;
- keywords ranqueadas;
- páginas indexadas;
- páginas crescendo;
- páginas perdendo tráfego.

### 4.4 Conversão

Indicadores:

- taxa de conversão geral;
- conversão por página;
- conversão por serviço;
- conversão por cidade;
- conversão por canal;
- conversão por dispositivo.

### 4.5 Leads

Indicadores:

- leads brutos;
- leads válidos;
- leads qualificados;
- leads inválidos;
- leads fora da área;
- leads comerciais;
- leads residenciais;
- leads de alto valor.

### 4.6 Operação

Indicadores:

- tempo médio de resposta;
- SLA cumprido;
- SLA perdido;
- leads em atendimento;
- leads encerrados;
- leads perdidos;
- parceiros ativos;
- distribuição por parceiro.

### 4.7 Mídia Paga

Indicadores:

- investimento;
- CPC;
- conversões;
- CPA;
- ROAS, quando aplicável;
- CTR;
- campanhas ativas.

### 4.8 Expansão

Indicadores:

- serviços com maior crescimento;
- cidades com maior crescimento;
- novas oportunidades;
- páginas prioritárias;
- clusters SEO prioritários;
- mercados com maior demanda.

---

## 5. KPIs Estratégicos

Os KPIs oficiais do Dashboard Executivo serão:

| KPI | Objetivo |
|---|---|
| Leads qualificados | Principal KPI |
| Conversão geral | Eficiência |
| Tráfego orgânico | Crescimento sustentável |
| Custo por lead | Eficiência financeira |
| Tempo médio de resposta | Eficiência operacional |
| CTR orgânico | Qualidade SEO |
| Conversão por serviço | Priorização |
| Conversão por cidade | Expansão |

---

## 6. Alertas

O Dashboard deverá destacar automaticamente situações críticas.

Exemplos:

| Sinal | Condição |
|---|---|
| Verde | Crescimento superior a 20% |
| Amarelo | Queda entre 5% e 20% |
| Vermelho | Queda superior a 20% |

Também devem existir alertas para:

- aumento de leads inválidos;
- queda abrupta de conversões;
- aumento do CPA;
- perda de posição média no Google;
- aumento do abandono do Quote Flow;
- crescimento de erros técnicos.

---

## 7. Comparações

Todos os indicadores deverão permitir comparação com:

- ontem;
- últimos 7 dias;
- últimos 30 dias;
- últimos 90 dias;
- ano atual;
- ano anterior.

---

## 8. Segmentações

O Dashboard deverá permitir filtros por serviço, cidade, canal e dispositivo.

### 8.1 Serviço

- Roofing;
- Plumbing;
- HVAC;
- Electrical;
- Bathroom Remodeling;
- Flooring;
- Painting;
- Drywall;
- demais serviços documentados no GF-OS.

### 8.2 Cidade

- Riverview;
- Brandon;
- Tampa;
- Apollo Beach;
- Lithia;
- Ruskin;
- Wimauma;
- demais cidades atendidas.

### 8.3 Canal

- Google;
- Google Ads;
- direto;
- social;
- referral;
- email.

### 8.4 Dispositivo

- desktop;
- mobile;
- tablet.

---

## 9. Fontes de Dados

Os dashboards poderão consumir dados de:

- Google Analytics 4;
- Google Search Console;
- Google Ads;
- CRM;
- banco de leads;
- BigQuery, no futuro;
- banco operacional do GetEstimateFast;
- APIs futuras.

---

## 10. Frequência de Atualização

| Indicador | Frequência |
|---|---|
| Tráfego | Diário |
| SEO | Diário |
| Leads | Tempo quase real |
| Operação | Tempo quase real |
| Google Ads | Diário |
| Dashboards executivos | Diário |
| Relatórios consolidados | Mensal |

---

## 11. Dashboard Executivo Ideal

A primeira tela deve apresentar:

- total de usuários;
- leads;
- conversão;
- receita estimada;
- crescimento;
- serviços em alta;
- cidades em alta;
- alertas.

Essa visão deve ser clara o suficiente para leitura executiva sem necessidade de navegar por várias páginas.

---

## 12. Dashboards Especializados

O Dashboard Executivo será apenas a camada superior.

Os dashboards especializados serão documentados posteriormente:

- Dashboard SEO;
- Dashboard Google Ads;
- Dashboard Leads;
- Dashboard Operacional;
- Dashboard Financeiro;
- Dashboard Comercial;
- Dashboard de Expansão.

---

## 13. Regras de Visualização

O Dashboard deverá:

- utilizar poucos gráficos por tela;
- evitar excesso de cores;
- destacar indicadores críticos;
- priorizar leitura em desktop;
- ser responsivo para mobile;
- utilizar nomenclatura oficial do GF-OS.

---

## 14. Evolução

A arquitetura deve permitir futuras integrações com:

- Power BI;
- Looker Studio;
- Grafana;
- Metabase;
- BigQuery;
- Data Warehouse corporativo;
- IA para análise preditiva.

---

## 15. Critério de Sucesso

O Dashboard Executivo será considerado completo quando permitir que um gestor compreenda a situação do GetEstimateFast em menos de cinco minutos e consiga identificar rapidamente:

- principais oportunidades;
- principais riscos;
- prioridades operacionais;
- evolução do SEO;
- desempenho das campanhas;
- qualidade dos leads;
- expansão geográfica;
- crescimento da plataforma.

---

## 16. Conclusão

O **GFDATA-003** estabelece a camada estratégica de visualização do GetEstimateFast.

Enquanto os documentos anteriores definem **quais dados coletar** e **como medi-los**, este documento define **como esses dados serão apresentados para apoiar decisões**.

Ele serve como base para a construção futura de dashboards em ferramentas como Looker Studio, Power BI, Metabase ou outras plataformas de Business Intelligence, mantendo consistência com toda a arquitetura do GF-OS.
