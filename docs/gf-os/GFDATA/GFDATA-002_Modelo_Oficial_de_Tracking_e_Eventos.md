# GFDATA-002 - Modelo Oficial de Tracking e Eventos do GetEstimateFast

Versão: 0.1  
Status: Draft  
Sistema: GF-OS  
Série: GFDATA  
Projeto: GetEstimateFast  
Área: Dados, Analytics e Business Intelligence  

---

## 1. Finalidade

O documento **GFDATA-002 - Modelo Oficial de Tracking e Eventos do GetEstimateFast** define o padrão oficial para rastreamento de eventos, conversões, interações e comportamento dos usuários dentro da plataforma GetEstimateFast.

Seu objetivo é garantir que Google Analytics 4, Google Ads, Search Console, dashboards, relatórios internos e futuras integrações operacionais possam medir a jornada do usuário de forma clara, consistente e útil.

Este documento serve como base para instrumentação técnica, análise de conversão, otimização de SEO, melhoria de produto, mensuração de campanhas e qualificação de leads.

---

## 2. Princípio Central

O tracking do GetEstimateFast deve responder uma pergunta principal:

**O usuário certo está chegando, interagindo, avançando no quote flow e gerando um lead qualificado?**

Para isso, cada evento deve ter:

- nome claro;
- finalidade definida;
- parâmetros padronizados;
- relação com uma decisão;
- valor analítico real;
- conexão com aquisição, produto, conversão ou operação.

Eventos sem uso claro devem ser evitados.

---

## 3. Escopo do Tracking

O modelo oficial de tracking cobre:

1. visitas e páginas;
2. origem do tráfego;
3. interações com CTAs;
4. início do quote flow;
5. etapas do quote flow;
6. abandono do quote flow;
7. envio de formulário;
8. cliques em telefone;
9. cliques em SMS;
10. cliques em WhatsApp, quando aplicável;
11. seleção de serviço;
12. localização do usuário;
13. conversões principais;
14. conversões secundárias;
15. eventos de qualidade e operação futura.

---

## 4. Ferramentas Prioritárias

As ferramentas iniciais consideradas neste modelo são:

- Google Analytics 4;
- Google Tag Manager, se utilizado;
- Google Ads;
- Google Search Console;
- Vercel Analytics, se utilizado;
- logs internos da aplicação, quando existirem;
- planilha, CRM ou banco operacional de leads.

O Markdown do GF-OS continua sendo a fonte oficial da regra de tracking. As ferramentas apenas executam e registram os dados.

---

## 5. Convenção de Nomes de Eventos

Os eventos devem seguir nomes em inglês, minúsculos, com palavras separadas por underscore.

### 5.1 Padrão recomendado

```text
ação_contexto
```

Exemplos:

```text
quote_start
quote_submit
service_select
city_submit
call_click
sms_click
whatsapp_click
form_error
```

### 5.2 Regras de nomenclatura

1. usar apenas letras minúsculas;
2. usar underscore entre palavras;
3. não usar espaços;
4. não usar acentos;
5. não usar nomes longos demais;
6. não duplicar eventos com o mesmo significado;
7. evitar nomes genéricos como `click`, `submit` ou `button`;
8. manter consistência entre GA4, GTM, documentação e dashboards.

---

## 6. Eventos Oficiais de Aquisição e Página

Esses eventos ajudam a entender como o usuário chegou e qual página iniciou a jornada.

| Evento | Quando dispara | Objetivo |
|---|---|---|
| page_view | Visualização de página | Medir tráfego por URL |
| landing_page_view | Primeira página da sessão | Identificar porta de entrada |
| local_page_view | Visualização de página local | Medir páginas por cidade |
| service_page_view | Visualização de página de serviço | Medir interesse por serviço |
| blog_page_view | Visualização de artigo | Medir conteúdo informacional |
| thank_you_view | Visualização da página de obrigado | Confirmar conclusão |

### 6.1 Parâmetros recomendados

| Parâmetro | Descrição |
|---|---|
| page_type | Tipo de página |
| page_path | Caminho da URL |
| service | Serviço relacionado |
| city | Cidade relacionada |
| state | Estado |
| traffic_source | Origem do tráfego |
| traffic_medium | Meio do tráfego |
| campaign | Campanha, quando disponível |

---

## 7. Eventos Oficiais de CTA

Esses eventos medem ações de intenção antes do envio do formulário.

| Evento | Quando dispara | Objetivo |
|---|---|---|
| cta_click | Clique em CTA principal | Medir força da chamada |
| quote_cta_click | Clique para iniciar orçamento | Medir intenção de quote |
| call_click | Clique em telefone | Medir intenção direta |
| sms_click | Clique em SMS | Medir intenção por mensagem |
| whatsapp_click | Clique em WhatsApp | Medir intenção por WhatsApp |
| email_click | Clique em e-mail, se existir | Medir contato alternativo |

### 7.1 Parâmetros recomendados

| Parâmetro | Descrição |
|---|---|
| cta_location | Local do CTA na página |
| cta_text | Texto do botão ou link |
| page_type | Tipo de página |
| service | Serviço relacionado |
| city | Cidade relacionada |
| device_type | Tipo de dispositivo |
| contact_method | Telefone, SMS, WhatsApp ou e-mail |

---

## 8. Eventos Oficiais do Quote Flow

O quote flow é uma das áreas mais importantes do tracking do GetEstimateFast.

### 8.1 Eventos principais

| Evento | Quando dispara | Objetivo |
|---|---|---|
| quote_start | Usuário inicia o quote flow | Medir intenção inicial |
| quote_step_view | Usuário visualiza uma etapa | Medir progresso |
| quote_step_complete | Usuário conclui uma etapa | Medir avanço |
| quote_back | Usuário volta etapa | Identificar dúvida ou fricção |
| quote_abandon | Usuário abandona o fluxo | Identificar perda |
| quote_submit | Usuário envia o formulário | Medir conversão principal |
| quote_submit_error | Erro ao enviar formulário | Identificar falha técnica |

### 8.2 Parâmetros recomendados

| Parâmetro | Descrição |
|---|---|
| quote_id | Identificador único do fluxo, quando disponível |
| step_number | Número da etapa |
| step_name | Nome da etapa |
| service | Serviço selecionado |
| city | Cidade informada |
| state | Estado |
| zip_code | ZIP Code informado, se disponível |
| property_type | Tipo de imóvel |
| project_type | Tipo de projeto |
| urgency | Urgência do cliente |
| device_type | Tipo de dispositivo |
| source_page | Página onde o fluxo começou |

---

## 9. Etapas Recomendadas do Quote Flow

A estrutura pode evoluir, mas o tracking deve considerar estas etapas iniciais:

| Etapa | Nome técnico | Objetivo |
|---|---|---|
| Serviço | service_step | Identificar serviço desejado |
| Localização | location_step | Identificar área de atendimento |
| Detalhes do projeto | project_details_step | Entender escopo |
| Urgência | urgency_step | Entender prioridade |
| Contato | contact_step | Capturar dados do cliente |
| Revisão | review_step | Confirmar dados |
| Envio | submit_step | Concluir solicitação |

Nem todo fluxo precisa ter todas as etapas, mas os nomes devem ser padronizados quando existirem.

---

## 10. Eventos Oficiais de Serviço

Esses eventos ajudam a entender quais serviços geram interesse e conversão.

| Evento | Quando dispara | Objetivo |
|---|---|---|
| service_select | Usuário seleciona serviço | Medir intenção por serviço |
| service_change | Usuário altera serviço | Identificar dúvida |
| service_page_cta_click | CTA em página de serviço | Medir força da página |
| service_quote_submit | Quote enviado para serviço específico | Medir conversão por serviço |

### 10.1 Serviços iniciais padronizados

Os valores do parâmetro `service` devem seguir nomes padronizados:

| Valor | Serviço |
|---|---|
| roofing | Roofing |
| plumbing | Plumbing |
| hvac | HVAC |
| electrical | Electrical |
| bathroom_remodeling | Bathroom Remodeling |
| kitchen_remodeling | Kitchen Remodeling |
| flooring | Flooring |
| painting | Painting |
| drywall | Drywall |
| general_contractor | General Contractor |
| drainage | Drainage |
| foundation_repair | Foundation Repair |
| concrete | Concrete |
| impact_windows | Impact Windows |
| generator_installation | Generator Installation |
| commercial_contractor | Commercial Contractor |

---

## 11. Eventos Oficiais de Localização

Esses eventos ajudam a medir demanda por cidade, ZIP Code e área de atendimento.

| Evento | Quando dispara | Objetivo |
|---|---|---|
| city_select | Usuário seleciona cidade | Medir demanda local |
| zip_submit | Usuário informa ZIP Code | Validar área |
| location_submit | Usuário conclui etapa de localização | Medir avanço |
| out_of_area_detected | Localização fora da área | Ajustar cobertura |
| service_area_match | Localização dentro da área | Medir demanda válida |

### 11.1 Cidades iniciais prioritárias

| Valor | Cidade / Área |
|---|---|
| riverview | Riverview |
| brandon | Brandon |
| valrico | Valrico |
| gibsonton | Gibsonton |
| apollo_beach | Apollo Beach |
| lithia | Lithia |
| fish_hawk | Fish Hawk |
| ruskin | Ruskin |
| sun_city_center | Sun City Center |
| wimauma | Wimauma |
| tampa | Tampa |
| tampa_bay | Tampa Bay |
| hillsborough_county | Hillsborough County |

---

## 12. Eventos Oficiais de Conversão

As conversões devem ser separadas entre principais e secundárias.

### 12.1 Conversões principais

| Evento | Conversão | Observação |
|---|---|---|
| quote_submit | Envio de formulário | Conversão principal |
| thank_you_view | Página de obrigado | Confirmação técnica |
| qualified_lead_created | Lead qualificado criado | Conversão operacional futura |
| partner_lead_sent | Lead enviado a parceiro | Conversão comercial futura |

### 12.2 Conversões secundárias

| Evento | Conversão | Observação |
|---|---|---|
| call_click | Clique em telefone | Alta intenção |
| sms_click | Clique em SMS | Alta intenção |
| whatsapp_click | Clique em WhatsApp | Alta intenção |
| email_click | Clique em e-mail | Intenção alternativa |
| quote_start | Início do quote flow | Microconversão |
| quote_step_complete | Avanço de etapa | Microconversão |

### 12.3 Hierarquia de conversões

A hierarquia recomendada é:

1. lead qualificado;
2. formulário enviado;
3. clique direto de contato;
4. início do quote flow;
5. avanço em etapas;
6. visualização de páginas estratégicas.

---

## 13. Parâmetros Oficiais

Os parâmetros são essenciais para segmentar relatórios e dashboards.

| Parâmetro | Uso |
|---|---|
| service | Serviço relacionado |
| city | Cidade relacionada |
| state | Estado |
| zip_code | ZIP Code |
| page_type | Tipo de página |
| page_path | URL ou caminho da página |
| source_page | Página de origem do evento |
| traffic_source | Origem do tráfego |
| traffic_medium | Meio do tráfego |
| campaign | Nome da campanha |
| device_type | Desktop, mobile ou tablet |
| quote_id | Identificador do quote flow |
| lead_id | Identificador do lead, quando existir |
| step_number | Número da etapa |
| step_name | Nome da etapa |
| urgency | Urgência declarada |
| project_type | Tipo de projeto |
| property_type | Tipo de imóvel |
| contact_method | Método de contato |
| lead_type | Residencial, comercial ou indefinido |
| lead_quality | Bruto, válido, qualificado, inválido etc. |

---

## 14. Tipos Oficiais de Página

O parâmetro `page_type` deve usar valores padronizados.

| Valor | Descrição |
|---|---|
| home | Página inicial |
| service | Página de serviço |
| local_service | Página de serviço local |
| city | Página de cidade |
| blog | Artigo de blog |
| guide | Guia educativo |
| quote_flow | Página ou etapa de orçamento |
| thank_you | Página de obrigado |
| legal | Página legal |
| about | Página institucional |
| contact | Página de contato |

---

## 15. Tipos Oficiais de Lead

O parâmetro `lead_type` deve seguir valores padronizados.

| Valor | Descrição |
|---|---|
| residential | Lead residencial |
| commercial | Lead comercial |
| emergency | Lead urgente |
| high_value | Lead de alto valor |
| unknown | Tipo ainda não definido |

---

## 16. Qualidade Oficial do Lead

O parâmetro `lead_quality` deve seguir a classificação da série GFDATA.

| Valor | Descrição |
|---|---|
| raw | Lead bruto |
| valid | Lead válido |
| qualified | Lead qualificado |
| invalid | Lead inválido |
| duplicate | Lead duplicado |
| out_of_area | Fora da área |
| out_of_scope | Fora do escopo |
| urgent | Urgente |
| high_value | Alto valor |

---

## 17. Modelo de Funil Principal

O funil principal do GetEstimateFast deve ser medido assim:

1. `page_view`
2. `quote_cta_click`
3. `quote_start`
4. `quote_step_view`
5. `quote_step_complete`
6. `quote_submit`
7. `thank_you_view`
8. `qualified_lead_created`
9. `partner_lead_sent`
10. `lead_outcome_recorded`

Esse funil permite medir perda, avanço, conversão e valor operacional.

---

## 18. Modelo de Funil Alternativo de Contato Direto

Nem todo usuário preencherá formulário. Alguns irão preferir contato direto.

Funil alternativo:

1. `page_view`
2. `cta_click`
3. `call_click`, `sms_click` ou `whatsapp_click`
4. `direct_contact_lead_created`
5. `lead_quality_updated`
6. `lead_outcome_recorded`

Esse funil deve ser medido separadamente para não subestimar a conversão real da plataforma.

---

## 19. Relação com Google Ads

Eventos usados como conversão no Google Ads devem ser escolhidos com cuidado.

### 19.1 Conversões recomendadas para Google Ads

| Evento | Tipo |
|---|---|
| quote_submit | Conversão principal |
| call_click | Conversão secundária ou principal, conforme campanha |
| sms_click | Conversão secundária |
| whatsapp_click | Conversão secundária |
| qualified_lead_created | Conversão avançada futura |

### 19.2 Cuidados

O GetEstimateFast não deve otimizar campanhas apenas para cliques se esses cliques não gerarem leads válidos.

Quando possível, a otimização deve evoluir de:

1. clique;
2. formulário enviado;
3. lead válido;
4. lead qualificado;
5. lead com valor comercial.

---

## 20. Relação com SEO

O tracking deve ajudar a medir SEO por página, serviço e cidade.

Perguntas que o tracking deve responder:

- qual página orgânica gerou lead?
- qual query trouxe tráfego qualificado?
- qual cidade gera mais conversão?
- qual serviço converte melhor organicamente?
- quais artigos ajudam a iniciar jornada?
- quais páginas têm tráfego, mas não geram ação?
- quais páginas locais precisam de melhoria?

A integração entre Search Console, GA4 e dados de leads deve ser documentada em relatórios futuros.

---

## 21. Relação com Operações

No futuro, eventos operacionais devem conectar o lead à sua evolução comercial.

Eventos futuros recomendados:

| Evento | Quando dispara |
|---|---|
| lead_created | Lead criado no sistema |
| lead_validated | Lead validado |
| lead_rejected | Lead rejeitado |
| lead_qualified | Lead qualificado |
| partner_assigned | Parceiro designado |
| partner_lead_sent | Lead enviado ao parceiro |
| customer_contacted | Cliente contatado |
| estimate_scheduled | Orçamento agendado |
| job_won | Serviço fechado |
| job_lost | Serviço perdido |
| lead_outcome_recorded | Resultado registrado |

Esses eventos não precisam existir no início, mas devem orientar a evolução do sistema.

---

## 22. Regras de Implementação

A implementação técnica deve seguir estas regras:

1. eventos críticos devem ser testados antes de campanhas pagas;
2. eventos não devem disparar duplicados;
3. eventos de formulário devem diferenciar erro e sucesso;
4. cliques de telefone, SMS e WhatsApp devem ser rastreados;
5. parâmetros devem ser enviados sempre que disponíveis;
6. valores de `service` e `city` devem ser padronizados;
7. eventos devem funcionar em mobile e desktop;
8. conversões devem ser conferidas no GA4 e no Google Ads;
9. mudanças no tracking devem ser documentadas;
10. dados sensíveis não devem ser enviados indevidamente para ferramentas externas.

---

## 23. Dados Sensíveis e Privacidade

O tracking não deve enviar informações pessoais sensíveis para ferramentas como GA4 ou Google Ads.

Não enviar como parâmetro de evento:

- nome completo do cliente;
- telefone;
- e-mail;
- endereço completo;
- mensagem livre do cliente;
- fotos do projeto;
- documentos;
- qualquer dado pessoal desnecessário.

Quando necessário, o sistema pode usar identificadores internos como `lead_id` ou `quote_id`, desde que não exponham dados pessoais.

---

## 24. Testes de Validação

Antes de considerar o tracking aprovado, é necessário testar:

- disparo do `page_view`;
- disparo do `quote_start`;
- disparo de cada etapa do quote flow;
- disparo do `quote_submit`;
- disparo do `thank_you_view`;
- disparo de `call_click`;
- disparo de `sms_click`;
- disparo de `whatsapp_click`, se aplicável;
- envio correto dos parâmetros `service`, `city`, `page_type` e `source_page`;
- ausência de eventos duplicados;
- funcionamento em mobile;
- funcionamento em desktop;
- leitura no GA4 DebugView;
- leitura no Google Tag Manager Preview, se utilizado;
- leitura no Google Ads, quando configurado.

---

## 25. Critério de Sucesso

O modelo de tracking será considerado bem-sucedido quando permitir responder:

- quantos usuários iniciam o quote flow;
- quantos abandonam cada etapa;
- quais serviços geram mais leads;
- quais cidades geram mais leads;
- quais páginas convertem melhor;
- quais campanhas geram leads;
- quais canais trazem usuários qualificados;
- quais CTAs funcionam melhor;
- quais dispositivos convertem melhor;
- quais leads evoluem para oportunidade real.

---

## 26. Conclusão

O documento **GFDATA-002** define a base oficial de tracking e eventos do GetEstimateFast.

Ele cria uma linguagem comum entre produto, engenharia, SEO, mídia paga, operações e dados.

Com este modelo, o GetEstimateFast poderá medir melhor sua jornada de aquisição, entender onde perde usuários, otimizar campanhas, melhorar páginas, qualificar leads e construir uma base sólida para dashboards e Business Intelligence.
