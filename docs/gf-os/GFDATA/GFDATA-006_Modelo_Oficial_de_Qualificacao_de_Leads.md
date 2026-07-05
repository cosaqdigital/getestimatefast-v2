# GFDATA-006 - Modelo Oficial de Qualificação de Leads do GetEstimateFast

Versão: 0.1  
Status: Draft  
Sistema: GF-OS  
Série: GFDATA  
Projeto: GetEstimateFast  
Área: Dados, Analytics e Business Intelligence  

---

## 1. Finalidade

O documento **GFDATA-006 - Modelo Oficial de Qualificação de Leads do GetEstimateFast** define o padrão oficial para classificar, medir e interpretar a qualidade dos leads recebidos pela plataforma.

Seu objetivo é evitar que o GetEstimateFast avalie crescimento apenas por volume de contatos. A métrica central deve ser a geração de **leads válidos, qualificados e com potencial comercial real**.

---

## 2. Objetivo Central

O modelo deve responder:

**O lead recebido é válido, está dentro da área, corresponde a um serviço atendido e tem potencial comercial suficiente para justificar ação operacional ou repasse a parceiro?**

---

## 3. Classificações Oficiais de Lead

| Classificação | Definição |
|---|---|
| Lead bruto | Todo contato recebido pela plataforma |
| Lead válido | Lead com contato, localização e serviço utilizáveis |
| Lead inválido | Lead falso, incompleto ou sem possibilidade de atendimento |
| Lead duplicado | Lead repetido do mesmo cliente ou projeto |
| Lead fora da área | Lead localizado fora da cobertura operacional |
| Lead fora do escopo | Serviço não atendido pela plataforma |
| Lead qualificado | Lead válido com intenção clara e potencial comercial |
| Lead urgente | Lead com necessidade imediata |
| Lead alto valor | Lead com ticket potencial elevado |
| Lead residencial | Lead de homeowner ou imóvel residencial |
| Lead comercial | Lead de empresa, loja, escritório ou imóvel comercial |

---

## 4. Critérios de Validação

Um lead deve ser considerado **válido** quando possuir:

- nome ou identificação mínima;
- forma de contato utilizável;
- serviço solicitado;
- cidade ou ZIP Code;
- localização dentro da área atendida;
- solicitação coerente com a proposta do GetEstimateFast.

Um lead deve ser considerado **inválido** quando:

- não possui contato utilizável;
- parece spam;
- contém dados falsos;
- não informa serviço;
- não permite entendimento mínimo da solicitação;
- foi enviado por engano.

---

## 5. Critérios de Qualificação

Um lead válido pode ser considerado **qualificado** quando apresenta pelo menos parte dos seguintes sinais:

- serviço claramente definido;
- localização atendida;
- urgência real;
- escopo minimamente compreensível;
- intenção de contratar;
- orçamento compatível com o tipo de serviço;
- projeto possível de ser executado;
- potencial de repasse para parceiro;
- valor comercial relevante.

---

## 6. Modelo de Pontuação

O GetEstimateFast poderá usar um score simples de 0 a 100 pontos.

| Critério | Pontos |
|---|---:|
| Contato utilizável | 15 |
| Localização dentro da área | 15 |
| Serviço atendido | 15 |
| Escopo claro | 15 |
| Urgência ou intenção forte | 10 |
| Potencial de ticket | 15 |
| Perfil residencial ou comercial adequado | 5 |
| Possibilidade de repasse a parceiro | 10 |

### Interpretação

| Pontuação | Classificação |
|---|---|
| 0–39 | Lead fraco ou inválido |
| 40–59 | Lead válido, mas pouco qualificado |
| 60–79 | Lead qualificado |
| 80–100 | Lead qualificado de alto valor |

---

## 7. Sinais de Alto Valor

Um lead pode ser classificado como **alto valor** quando envolve:

- roof replacement;
- bathroom remodeling completo;
- kitchen remodeling;
- commercial build-out;
- electrical panel upgrade;
- generator installation;
- HVAC replacement;
- foundation repair;
- drainage correction relevante;
- múltiplos serviços no mesmo imóvel;
- projeto comercial;
- projeto com urgência e alto ticket.

---

## 8. Sinais de Baixa Qualidade

Um lead pode ser considerado de baixa qualidade quando apresenta:

- pedido muito genérico;
- falta de telefone ou e-mail;
- localização fora da área;
- orçamento incompatível;
- serviço fora do escopo;
- mensagem sem intenção clara;
- solicitação repetida;
- pedido de emprego em vez de serviço;
- spam;
- busca apenas informacional sem intenção de contratação.

---

## 9. Origem do Lead

Cada lead deve registrar sua origem sempre que possível.

| Origem | Uso |
|---|---|
| Organic Search | SEO |
| Google Ads | Mídia paga |
| Direct | Acesso direto |
| Referral | Indicação ou outro site |
| Social | Redes sociais |
| SMS | Contato direto por mensagem |
| Phone | Ligação |
| WhatsApp | Contato via WhatsApp |
| Unknown | Origem não identificada |

A origem deve ser usada para medir qualidade por canal, não apenas volume.

---

## 10. Relação com Serviço

Cada lead deve estar associado a um serviço principal.

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

Quando o lead envolver mais de um serviço, registrar:

- serviço principal;
- serviços secundários;
- possibilidade de projeto combinado.

---

## 11. Relação com Cidade e Área

Cada lead deve possuir localização classificada como:

| Status | Definição |
|---|---|
| Dentro da área | Cidade ou ZIP Code atendido |
| Próximo da área | Pode ser avaliado caso a caso |
| Fora da área | Não atendido |
| Indefinido | Localização ausente ou incompleta |

Cidades prioritárias:

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

---

## 12. Status Operacional do Lead

O lead deve possuir status operacional.

| Status | Significado |
|---|---|
| Novo | Lead recém-recebido |
| Em análise | Lead sendo verificado |
| Válido | Lead aproveitável |
| Inválido | Lead descartado |
| Qualificado | Lead com potencial |
| Fora da área | Localização não atendida |
| Fora do escopo | Serviço não atendido |
| Duplicado | Lead repetido |
| Enviado ao parceiro | Lead repassado |
| Contatado | Cliente recebeu contato |
| Aguardando cliente | Sem resposta do cliente |
| Orçamento agendado | Visita ou estimate marcado |
| Fechado | Serviço vendido |
| Perdido | Não converteu |
| Arquivado | Encerrado sem ação futura |

---

## 13. Dados Mínimos Recomendados

Cada lead deve conter, quando possível:

- data de entrada;
- origem;
- canal;
- nome;
- telefone;
- e-mail;
- cidade;
- ZIP Code;
- serviço solicitado;
- urgência;
- descrição do projeto;
- tipo de imóvel;
- classificação;
- score;
- status;
- responsável;
- parceiro indicado;
- resultado final.

---

## 14. Métricas de Qualificação

| Métrica | Fórmula |
|---|---|
| Taxa de lead válido | Leads válidos / leads brutos |
| Taxa de lead inválido | Leads inválidos / leads brutos |
| Taxa de lead qualificado | Leads qualificados / leads brutos |
| Taxa de lead fora da área | Leads fora da área / leads brutos |
| Taxa de lead fora do escopo | Leads fora do escopo / leads brutos |
| Taxa de alto valor | Leads alto valor / leads brutos |
| Custo por lead válido | Investimento / leads válidos |
| Custo por lead qualificado | Investimento / leads qualificados |

---

## 15. Relação com SEO

A qualificação de leads deve retroalimentar o SEO.

Perguntas importantes:

- quais páginas orgânicas geram leads válidos?
- quais serviços orgânicos geram leads qualificados?
- quais cidades orgânicas geram melhor qualidade?
- quais artigos trazem leads fora do escopo?
- quais queries atraem usuários errados?
- quais páginas precisam filtrar melhor a intenção?

SEO não deve ser avaliado apenas por tráfego, mas por capacidade de gerar leads úteis.

---

## 16. Relação com Google Ads

A qualificação de leads é essencial para mídia paga.

Perguntas importantes:

- quais campanhas geram leads válidos?
- quais campanhas geram leads inválidos?
- quais keywords atraem público errado?
- quais termos de busca devem ser negativados?
- quais serviços têm custo aceitável por lead qualificado?
- quais cidades desperdiçam orçamento?
- quais landing pages geram leads de melhor qualidade?

Google Ads não deve otimizar apenas para clique ou formulário enviado, mas para lead válido e qualificado.

---

## 17. Relação com Operações

A operação é responsável por confirmar a qualidade real do lead.

Sem feedback operacional, a análise fica incompleta.

A operação deve informar:

- se o contato funcionou;
- se o cliente respondeu;
- se o serviço era real;
- se a localização estava correta;
- se o lead tinha intenção de contratar;
- se foi possível agendar estimate;
- se foi enviado a parceiro;
- se virou serviço fechado ou perdido.

---

## 18. Relação com Produto

O produto deve usar dados de qualidade de leads para melhorar o quote flow.

Exemplos:

- muitos leads fora da área indicam necessidade de filtro por ZIP Code;
- muitos leads fora do escopo indicam copy confusa;
- muitos leads incompletos indicam formulário fraco;
- muitos leads inválidos indicam necessidade de validação;
- poucos leads qualificados indicam desalinhamento entre página, CTA e formulário.

---

## 19. Alertas de Qualidade

O sistema deve destacar alertas como:

| Alerta | Possível causa |
|---|---|
| Aumento de leads inválidos | Spam, campanha ruim ou formulário fraco |
| Aumento de leads fora da área | Segmentação geográfica ruim |
| Aumento de leads fora do escopo | Página ou anúncio desalinhado |
| Muitos leads sem telefone | Formulário permissivo demais |
| Muitos leads duplicados | Falta de controle operacional |
| Queda de leads qualificados | Tráfego menos qualificado |
| Alto custo por lead válido | Google Ads ineficiente |

---

## 20. Critério de Sucesso

O modelo será considerado bem-sucedido quando permitir responder:

- quantos leads são realmente válidos;
- quais canais geram melhores leads;
- quais serviços geram maior valor;
- quais cidades geram leads aproveitáveis;
- quais campanhas trazem leads ruins;
- quais páginas trazem leads qualificados;
- quais parceiros recebem os melhores leads;
- quais leads viram orçamento ou serviço fechado.

---

## 21. Conclusão

O **GFDATA-006** define o modelo oficial de qualificação de leads do GetEstimateFast.

Ele garante que crescimento seja medido por qualidade, não apenas por volume.

Com este modelo, o GetEstimateFast poderá melhorar SEO, Google Ads, produto, operação e estratégia comercial com base em leads reais, válidos e qualificados.
