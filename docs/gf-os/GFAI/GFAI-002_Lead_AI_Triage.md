# GFAI-002 - Lead AI Triage

Versao: 0.1  
Status: Draft  
Sistema: GF-OS  
Serie: GFAI  
Projeto: GetEstimateFast  
Area: Inteligencia Artificial e Automacoes

---

## 1. Finalidade

O documento **GFAI-002 - Lead AI Triage** estabelece o modelo oficial do agente de Inteligencia Artificial responsavel pela triagem inicial dos leads recebidos pelo GetEstimateFast.

Seu objetivo e reduzir o tempo de analise, aumentar a qualidade da qualificacao inicial e encaminhar cada solicitacao para o fluxo operacional mais adequado.

O agente atua como um assistente operacional. A decisao final continua sob responsabilidade humana.

---

## 2. Objetivos

O Lead AI Triage deve ser capaz de:

- interpretar os dados enviados no Quote Flow;
- identificar o servico solicitado;
- reconhecer a cidade e o ZIP Code;
- validar se o endereco esta dentro da area de atendimento;
- detectar informacoes ausentes;
- classificar a urgencia;
- estimar a qualidade inicial do lead;
- sugerir o parceiro mais adequado;
- gerar um resumo executivo para a equipe.

---

## 3. Entradas

O agente podera utilizar informacoes como:

### 3.1 Dados do cliente

- nome;
- telefone;
- e-mail.

### 3.2 Dados do servico

- categoria;
- descricao;
- fotos, quando houver;
- observacoes.

### 3.3 Dados geograficos

- cidade;
- estado;
- ZIP Code;
- coordenadas, quando disponiveis.

### 3.4 Dados do sistema

- historico do cliente;
- origem do lead;
- campanha;
- dispositivo;
- horario da solicitacao.

---

## 4. Processo de Triagem

Fluxo oficial:

1. receber o lead;
2. validar dados obrigatorios;
3. identificar servico principal;
4. verificar area de atendimento;
5. identificar possiveis inconsistencias;
6. calcular score inicial;
7. classificar prioridade;
8. sugerir parceiro compativel;
9. gerar resumo operacional;
10. encaminhar para revisao humana.

---

## 5. Classificacao Inicial

O agente devera classificar:

| Criterio | Possiveis valores |
|---|---|
| Area de atendimento | Dentro / Limitrofe / Fora |
| Qualidade dos dados | Completa / Parcial / Insuficiente |
| Tipo de servico | Residencial / Comercial |
| Urgencia | Baixa / Media / Alta / Emergencial |
| Complexidade | Baixa / Media / Alta |
| Potencial comercial | Baixo / Medio / Alto |

---

## 6. Score do Lead

Cada lead podera receber um score entre **0 e 100**.

Exemplo de fatores considerados:

- dados completos;
- localizacao valida;
- servico prioritario;
- descricao detalhada;
- presenca de imagens;
- compatibilidade com a area operacional;
- potencial de ticket.

O score e apenas um indicador de apoio e nao substitui analise humana.

---

## 7. Resumo Executivo

O agente devera produzir um resumo padronizado, contendo:

- servico solicitado;
- localizacao;
- principais necessidades identificadas;
- nivel de urgencia;
- qualidade das informacoes;
- possiveis duvidas;
- recomendacao inicial.

Esse resumo deve facilitar o primeiro contato da equipe.

---

## 8. Sugestao de Parceiro

Com base em:

- especialidade;
- cidade;
- disponibilidade;
- historico de desempenho;
- capacidade operacional.

O agente podera sugerir um ou mais parceiros para atendimento.

A atribuicao definitiva permanece sob responsabilidade da operacao.

---

## 9. Situacoes que Exigem Revisao Humana

O agente nunca devera decidir sozinho em casos como:

- informacoes contraditorias;
- localizacao ambigua;
- pedidos de alto valor;
- solicitacoes comerciais complexas;
- indicios de fraude;
- duvidas sobre o escopo do servico.

Nessas situacoes, o sistema devera marcar o lead para analise manual.

---

## 10. Indicadores do Agente

O desempenho devera ser acompanhado por metricas como:

- tempo medio de triagem;
- precisao da classificacao;
- taxa de correcao humana;
- tempo economizado;
- percentual de leads completos;
- percentual de leads fora da area;
- precisao da sugestao de parceiros.

---

## 11. Riscos

| Risco | Mitigacao |
|---|---|
| Servico identificado incorretamente | Revisao humana |
| Endereco mal interpretado | Validacao de localizacao |
| Classificacao inadequada | Ajuste continuo do modelo |
| Score incorreto | Recalibracao periodica |
| Sugestao inadequada de parceiro | Confirmacao operacional |

---

## 12. Integracoes

O Lead AI Triage devera integrar-se com:

- Quote Flow;
- GFDATA;
- GFOPS;
- CRM;
- banco de dados;
- dashboards operacionais;
- sistema de parceiros.

---

## 13. Criterio de Sucesso

O agente sera considerado eficaz quando:

- reduzir significativamente o tempo de triagem;
- aumentar a qualidade da classificacao inicial;
- reduzir erros operacionais;
- acelerar o encaminhamento dos leads;
- fornecer resumos uteis para a equipe;
- melhorar a distribuicao de parceiros.

---

## 14. Evolucao Futura

Versoes futuras poderao incluir:

- interpretacao automatica de imagens da obra;
- leitura de plantas e documentos;
- estimativa preliminar de complexidade;
- previsao de ticket;
- previsao de tempo de execucao;
- deteccao de solicitacoes semelhantes;
- aprendizado continuo baseado no historico.

---

## 15. Conclusao

O **GFAI-002** define o primeiro agente operacional de Inteligencia Artificial do GetEstimateFast.

Seu papel e transformar dados brutos enviados pelo cliente em informacoes estruturadas, permitindo uma operacao mais rapida, organizada e consistente, sempre mantendo a supervisao humana nas decisoes relevantes.
