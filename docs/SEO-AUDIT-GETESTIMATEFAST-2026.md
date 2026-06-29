# SEO Audit GetEstimateFast 2026

Data da auditoria: 2026-06-29  
Repositório auditado: `cosaqdigital/getestimatefast-v2`  
Site auditado: `https://www.getestimatefast.com/`

## A. Resumo executivo

O GetEstimateFast já saiu da fase de site vazio e entrou numa fase importante: o Google já rastreia e mostra URLs relevantes, mas o site ainda não converte impressões em cliques nem cliques em leads na velocidade esperada. O principal gargalo hoje não é um único problema. É a combinação de arquitetura híbrida, quote flows indexáveis, cluster comercial ainda incompleto, páginas legadas fracas, rastreamento de conversão superficial e distribuição desigual de autoridade interna.

Estado geral observado:

| Área | Estado | Leitura executiva |
| --- | --- | --- |
| Indexação | Médio | O site está indexado e com impressões reais, mas expõe URLs que não deveriam disputar SERP, como quote flows. |
| SEO técnico | Médio | GA4 principal está consistente, mas há canônicos incorretos em fluxos, títulos duplicados e schema fraco em páginas relevantes. |
| SEO local | Médio | O cluster de Riverview começou bem, especialmente roofing e plumbing, mas ainda faltam páginas comerciais e satélites para várias intenções. |
| Conteúdo | Médio | Os blogs novos são melhores que as páginas antigas, mas vários money pages ainda são rasos e pouco diferenciados. |
| Links internos | Médio para fraco | Hubs e quote flows recebem links demais; várias páginas comerciais recebem links de menos. |
| Conversão | Médio | A proposta de valor melhorou, mas ainda falta instrumentação de funil e redução de ambiguidade entre páginas informativas e páginas de request. |
| Performance | Médio | JS e CSS estão aceitáveis; o problema maior são imagens grandes e duplicação de ativos. |
| Acessibilidade/HTML | Médio | Estrutura geral aceitável, mas os flows sem H1 e algumas páginas antigas ficam abaixo do ideal. |
| Manutenção | Fraco | README está desatualizado, há coexistência de root/prod, preview e staging com GA4 habilitado, e a arquitetura ficou mais difícil de governar. |

## B. Diagnóstico do estado atual

Sinais positivos já conquistados:

- O domínio principal responde com `200` e redireciona `getestimatefast.com` para `www.getestimatefast.com`.
- `robots.txt` e `sitemap.xml` estão públicos e válidos para rastreamento básico.
- A tag principal do GA4 `G-D4PB807CDR` está presente nas páginas HTML de produção auditadas.
- A tag antiga `G-DYXJ4PHZ18` não foi encontrada nas páginas de produção auditadas.
- O `thank-you.html` está com `noindex,follow`, fora do sitemap e visualmente funcional.
- Os clusters locais mais novos têm linguagem mais segura e mais alinhada ao modelo real do negócio.

Sinais de estagnação observados:

- Search Console mostra impressões, mas CTR está em `0%`.
- URLs de quote flow aparecem em impressões, o que desvia sinais para páginas transacionais fracas.
- Há convivência entre páginas antigas e novas competindo pela mesma intenção.
- O cluster comercial de maior tração atual é roofing, mas o restante ainda não acompanha a mesma profundidade.
- A home e `services.html` ainda distribuem autoridade de forma ampla demais para quote flows e ampla de menos para páginas locais prioritárias.

## C. Problemas críticos

| Prioridade | Problema | Arquivos / URLs | Impacto | Correção recomendada |
| --- | --- | --- | --- | --- |
| Crítica | Quote flows estão indexáveis, sem H1 e com canonical para URLs inexistentes `/request/` | `/quote-flow-standard.html`, `/quote-flow-kitchen.html`, `/quote-flow-house-cleaning.html`, inclusive `/quote-flow-standard.html?service=roofing` | Gera impressões desperdiçadas, baixa qualidade percebida na SERP, confusão de indexação e possível canibalização | Remover da indexação com `noindex,follow` ou bloquear via estratégia canônica consistente; alinhar canonical para URL real ou desindexar completamente. |
| Crítica | `quote-flow-standard.html?service=roofing` já aparece no Search Console | URL pública ao vivo | O Google está usando uma página de funil como landing page orgânica para query comercial | Priorizar desindexação dos flows e reforçar páginas comerciais locais equivalentes. |
| Crítica | Título duplicado em kitchen | `/kitchen-remodeling.html`, `/service-kitchen-remodeling.html` | Sinal ambíguo de relevância para a mesma intenção | Diferenciar claramente ou consolidar uma das páginas como principal. |
| Alta | Páginas antigas de serviço têm pouco conteúdo, zero schema e zero tracking | `/bathroom-remodeling.html`, `/drywall.html`, `/electrical.html`, `/flooring-installation.html`, `/handyman.html`, `/kitchen-remodeling.html`, `/painting.html`, `/plumbing.html` | Parte do site ainda parece “versão antiga”, menos confiável e menos rankeável | Decidir entre reescrever, redirecionar, canonicalizar ou aposentar gradualmente. |
| Alta | Algumas páginas locais novas ainda têm schema incompleto | `/hvac-contractor-riverview-fl.html`, `/foundation-repair-riverview-fl.html`, `/general-contractor-riverview-fl.html`, `/drainage-contractor-riverview-fl.html` | Menor riqueza semântica em páginas de intenção comercial forte | Adicionar pelo menos `BreadcrumbList` e `FAQPage` visível + JSON-LD correspondente. |
| Alta | README documenta FormSubmit e “sem backend”, mas produção usa `/api/lead` com Resend | `/README.md`, `/api/lead.js` | Aumenta risco operacional e onboarding incorreto | Atualizar README para a arquitetura real. |
| Alta | Staging e preview carregam GA4 real | `/preview/**`, `/staging/platform-phase2/templates/*.html`, `/staging/platform-phase2/generated-pages/**` | Polui analytics com ambientes não produtivos, mesmo com `noindex,nofollow` | Desativar GA4 em preview/staging ou separar Measurement ID. |
| Média | `services.html` está com title e description fracos | `/services.html` | CTR e relevância abaixo do potencial para página hub | Reescrever metadados com termos de serviço e localidade. |
| Média | Imagem principal muito pesada | `/assets/images/service-kitchen.png` (~2.15 MB) | Piora LCP, principalmente em conexões móveis | Converter e servir versão otimizada; remover se não for usada. |
| Média | Não há eventos robustos de conversão no thank-you | `/thank-you.html`, `/assets/platform-forms.js` | Dificulta otimização de mídia paga, SEO assistido e funil real | Implementar `lead_submit_success` e `thank_you_view` com dados mínimos consistentes. |

## D. SEO técnico

### D.1 Rastreamento, tags e inconsistências

Checagem resumida por grupos:

| Grupo | GA4 `G-D4PB807CDR` | Tag antiga `G-DYXJ4PHZ18` | Ads `AW-18110530676` | Observação |
| --- | --- | --- | --- | --- |
| Root produção (`*.html`) | Presente nas 54 páginas auditadas | Ausente | Presente em 8 páginas | Estado bom em produção. |
| Preview (`/preview/**`) | Presente | Ausente | Não observado | Não deveria usar o mesmo GA4 de produção. |
| Staging (`/staging/platform-phase2/generated-pages/**`) | Presente | Ausente | Não observado | `noindex,nofollow`, mas ainda assim rastreia analytics real. |

Páginas antigas sem `data-track`:

| Página | `data-track` | Risco |
| --- | --- | --- |
| `/bathroom-remodeling.html` | 0 | Sem visibilidade de CTA e microfunil |
| `/drywall.html` | 0 | Sem visibilidade de CTA e microfunil |
| `/electrical.html` | 0 | Sem visibilidade de CTA e microfunil |
| `/flooring-installation.html` | 0 | Sem visibilidade de CTA e microfunil |
| `/handyman.html` | 0 | Sem visibilidade de CTA e microfunil |
| `/kitchen-remodeling.html` | 0 | Sem visibilidade de CTA e microfunil |
| `/painting.html` | 0 | Sem visibilidade de CTA e microfunil |
| `/plumbing.html` | 0 | Sem visibilidade de CTA e microfunil |

Eventos que deveriam existir e hoje ainda não estão claramente fechados no produto:

| Evento recomendado | Onde disparar | Objetivo |
| --- | --- | --- |
| `cta_click` | Home, hubs, páginas comerciais, blogs | Medir quais portas de entrada geram início de jornada |
| `service_selected` | Service Search Starter, hubs e cards | Medir intenção por serviço |
| `start_quote_flow` | Primeiro carregamento do flow | Medir início real de solicitação |
| `quote_step_completed` | Cada avanço relevante no flow | Detectar queda por etapa |
| `form_submit_attempt` | Clique em submit | Separar tentativa de sucesso real |
| `lead_submit_success` | Redirect concluído ou resposta positiva de `/api/lead` | Medir conversão real |
| `thank_you_view` | Carregamento de `/thank-you.html` | Fechar funil de lead |

### D.2 Titles, descriptions, H1, canonical e robots

Achados principais:

| Página | Problema | Impacto | Prioridade | Correção recomendada |
| --- | --- | --- | --- | --- |
| `/quote-flow-standard.html` | Sem H1, `index,follow`, canonical para `https://www.getestimatefast.com/request/` | Indexação ruim e sinal confuso | Crítica | Desindexar e alinhar canonical/URL real |
| `/quote-flow-kitchen.html` | Sem H1, `index,follow`, canonical para `/kitchen-remodeling/request/` | Mesmo problema | Crítica | Desindexar e alinhar canonical/URL real |
| `/quote-flow-house-cleaning.html` | Sem H1, `index,follow`, canonical para `/house-cleaning/request/` | Mesmo problema | Crítica | Desindexar e alinhar canonical/URL real |
| `/kitchen-remodeling.html` + `/service-kitchen-remodeling.html` | Title duplicado | Canibalização e diluição | Crítica | Diferenciar ou consolidar |
| `/services.html` | Title curto: `Services | GetEstimateFast`; description curta/fraca | CTR e contexto abaixo do ideal | Média | Reescrever com foco em serviços + Tampa Bay |
| `/thank-you.html` | Title curto, mas funcional | Baixo impacto por ser `noindex` | Baixa | Opcional |

Páginas com description especialmente fraca ou curta:

- `/drywall.html`
- `/flooring-installation.html`
- `/quote-flow-standard.html`
- `/quote-flow-house-cleaning.html`
- `/thank-you.html`
- `/services.html`

Páginas com description longa além do ideal, mas não necessariamente críticas:

- vários blogs e páginas locais novas ficam acima de 160 caracteres; o maior problema é CTR, não indexação.

### D.3 Schema JSON-LD

Páginas com schema fraco ou ausente:

| Página | JSON-LD observado | Lacuna |
| --- | --- | --- |
| `/bathroom-remodeling.html` | 0 | Sem Organization, FAQ, Breadcrumb ou Service |
| `/drywall.html` | 0 | Mesmo problema |
| `/electrical.html` | 0 | Mesmo problema |
| `/flooring-installation.html` | 0 | Mesmo problema |
| `/handyman.html` | 0 | Mesmo problema |
| `/kitchen-remodeling.html` | 0 | Mesmo problema |
| `/painting.html` | 0 | Mesmo problema |
| `/plumbing.html` | 0 | Mesmo problema |
| `/hvac-contractor-riverview-fl.html` | 1 | Falta Breadcrumb e FAQ schema |
| `/foundation-repair-riverview-fl.html` | 1 | Falta Breadcrumb e FAQ schema |
| `/general-contractor-riverview-fl.html` | 1 | Falta Breadcrumb e FAQ schema |
| `/drainage-contractor-riverview-fl.html` | 1 | Falta Breadcrumb e FAQ schema |

Recomendação prática:

1. Padronizar money pages novas com no mínimo `Service`, `FAQPage` e `BreadcrumbList`.
2. Decidir se páginas antigas serão atualizadas ou retiradas do jogo orgânico.
3. Nos quote flows, remover breadcrumbs indexáveis se a estratégia for desindexar.

### D.4 Links quebrados, sitemap e indexação

Checagem automatizada entre HTMLs da raiz:

- Nenhum link interno quebrado foi encontrado na malha de arquivos `*.html` de produção.
- Páginas fora do sitemap, de forma observada:
  - `/thank-you.html` — correto por ser `noindex`
  - `/quote-flow-standard.html`
  - `/quote-flow-kitchen.html`
  - `/quote-flow-house-cleaning.html`

O problema não é elas estarem fora do sitemap. O problema é estarem fora do sitemap e ainda assim indexáveis.

## E. SEO local

### E.1 Leitura por cluster prioritário

| Cluster | Estado | Leitura |
| --- | --- | --- |
| Roofing | Forte relativo | Melhor cluster comercial atual. Já tem página local, blog de suporte e links reforçados. |
| Plumbing | Médio | Bom artigo de emergência e página local razoável, mas ainda falta cluster de sintomas e water heater. |
| HVAC / AC | Médio | AC repair tem boa intenção. HVAC contractor ainda precisa de schema e cluster satélite mais completo. |
| General Contractor | Médio para fraco | Página existe, mas ainda falta profundidade de cluster e validação semântica forte. |
| Foundation Repair | Médio para fraco | Boa oportunidade local, mas ainda pouco suportada por links e schema. |
| Electrical | Médio para fraco | Intenção forte, mas cluster ainda curto. |
| Drainage | Médio para fraco | Bom potencial local, mas ainda precisa mais ligação com foundation e storms. |
| Bathroom Remodeling | Fraco a médio | Páginas locais existem, mas cluster comercial principal ainda depende muito da arquitetura antiga. |
| Kitchen Remodeling | Fraco estruturalmente | Duplicidade entre páginas e presença de flow indexável atrapalham o cluster. |
| Flooring | Fraco a médio | Há páginas locais e blog, mas página comercial raiz antiga continua rasa. |
| House Cleaning | Médio em conversão, fraco em SEO | Flow premium bom para lead, mas quase não há suporte orgânico comercial além do flow. |

### E.2 Análise página por página

| Página | Keyword principal sugerida | Keywords secundárias | Intenção atendida hoje | Gaps | Prioridade |
| --- | --- | --- | --- | --- | --- |
| `/roofing-contractor-riverview-fl.html` | roofing contractor riverview fl | roof repair riverview fl, roof replacement riverview fl, storm damage roof repair riverview | Comercial local | Falta receber ainda mais links internos e artigos satélite | Alta |
| `/blog-emergency-plumber-riverview-fl.html` | emergency plumber riverview fl | leak repair riverview fl, toilet overflow riverview fl, water heater issue riverview | Informacional com ponte comercial | Precisa empurrar mais autoridade para plumber page e water heater cluster | Alta |
| `/plumber-riverview-fl.html` | plumber riverview fl | emergency plumber riverview fl, water heater repair riverview fl | Comercial local | Precisa de mais links, mais satélites e mais sinais de trust | Alta |
| `/hvac-contractor-riverview-fl.html` | hvac contractor riverview fl | ac replacement riverview fl, hvac maintenance riverview fl | Comercial local | Schema fraco, poucos links, cluster ainda inicial | Alta |
| `/ac-repair-riverview-fl.html` | ac repair riverview fl | air conditioning repair riverview fl, ac not cooling riverview fl | Comercial local alta intenção | Bom início, mas pode ganhar mais queries de sintomas | Alta |
| `/foundation-repair-riverview-fl.html` | foundation repair riverview fl | slab crack riverview fl, settling foundation riverview | Comercial local | Schema fraco e pouca autoridade interna | Alta |
| `/general-contractor-riverview-fl.html` | general contractor riverview fl | remodeling contractor riverview fl, project coordination riverview | Comercial local ampla | Muito genérica; precisa cluster satélite e diferenciação | Alta |
| `/flooring-installation.html` | flooring installation riverview fl | vinyl plank flooring riverview, tile flooring riverview | Comercial antiga | Conteúdo raso, sem schema e sem tracking | Alta |
| `/kitchen-remodeling.html` | kitchen remodeling riverview fl | kitchen remodel estimates riverview, kitchen contractors riverview | Comercial antiga | Duplicidade com `/service-kitchen-remodeling.html`, conteúdo raso | Crítica |
| `/bathroom-remodeling.html` | bathroom remodeling riverview fl | shower remodel riverview, bathroom tile riverview | Comercial antiga | Conteúdo raso, sem schema e sem tracking | Alta |
| `/electrician-riverview-fl.html` | electrician riverview fl | panel upgrade riverview fl, ev charger installation riverview fl | Comercial local | Precisa mais links e cluster satélite | Alta |
| `/drainage-contractor-riverview-fl.html` | drainage contractor riverview fl | yard drainage riverview fl, pooling water near foundation riverview | Comercial local | Schema fraco e cluster pequeno | Alta |

### E.3 Cidades e cobertura local

Cobertura hoje:

- Forte: Riverview
- Em evolução: Brandon
- Fraca como cluster próprio: Valrico, Gibsonton, Apollo Beach
- Menções contextuais existem, mas ainda faltam páginas dedicadas e interligações por intenção

Recomendação:

1. Fechar primeiro os clusters de serviço com maior demanda em Riverview.
2. Duplicar a estratégia vencedora para Brandon.
3. Só depois abrir novas cidades como Valrico e Apollo Beach.

## F. Conteúdo e clusters

### F.1 Mapa atual de conteúdo

| Cluster | Money pages | Support content | Estado |
| --- | --- | --- | --- |
| Roofing | `/roofing-contractor-riverview-fl.html`, `/roofing-contractor-brandon-fl.html` | `/blog-roof-repair-vs-replacement-riverview-fl.html` | Bom início |
| Plumbing | `/plumber-riverview-fl.html`, `/plumber-brandon-fl.html` | `/blog-emergency-plumber-riverview-fl.html`, `/blog-hidden-plumbing-leak-signs-florida-homes.html` | Bom início |
| HVAC | `/ac-repair-riverview-fl.html`, `/hvac-contractor-riverview-fl.html`, `/ac-repair-brandon-fl.html` | `/blog-ac-repair-riverview-fl.html`, `/blog-hvac-contractor-riverview-fl.html` | Médio |
| Foundation/Drainage | `/foundation-repair-riverview-fl.html`, `/drainage-contractor-riverview-fl.html` | `/blog-foundation-warning-signs-florida-homeowners.html`, `/blog-drainage-problems-riverview-yards.html` | Médio |
| Bathroom | páginas localizadas + antiga raiz | `/blog-bathroom-remodel-cost-riverview-fl.html` | Médio para fraco |
| Flooring | páginas localizadas + antiga raiz | `/blog-best-flooring-options-florida-homes.html`, `/blog-when-to-replace-flooring-florida-homes.html` | Médio |
| Drywall | páginas localizadas + antiga raiz | `/blog-drywall-repair-vs-replacement.html` | Médio |
| Painting | páginas localizadas + antiga raiz | `/blog-interior-painting-cost-tampa-bay.html` | Médio para fraco |
| Kitchen | `/service-kitchen-remodeling.html`, `/kitchen-remodeling.html`, flow premium | pouco suporte orgânico proporcional | Fraco estruturalmente |
| House Cleaning | flow premium | quase sem cluster orgânico de apoio | Fraco |

### F.2 Páginas fortes, fracas e ausentes

Páginas fortes:

- `/index.html`
- `/roofing-contractor-riverview-fl.html`
- `/blog-emergency-plumber-riverview-fl.html`
- `/blog-roof-repair-vs-replacement-riverview-fl.html`
- `/areas-we-serve.html`
- `/blog.html`

Páginas fracas:

- `/bathroom-remodeling.html`
- `/drywall.html`
- `/electrical.html`
- `/flooring-installation.html`
- `/handyman.html`
- `/kitchen-remodeling.html`
- `/painting.html`
- `/plumbing.html`
- quote flows orgânicos

Páginas ausentes com bom potencial:

- Página comercial forte de house cleaning além do flow
- Cluster local de water heater
- Cluster local de roof leak / storm damage
- Cluster local de panel upgrade / EV charger
- Cluster local de bathroom shower remodel
- Cluster local de flooring by material and by city

## G. Links internos

### G.1 Diagnóstico

Páginas mais linkadas internamente no root:

- `/services.html`
- `/quote-flow-standard.html`
- `/index.html`
- `/blog.html`
- `/areas-we-serve.html`
- `/service-kitchen-remodeling.html`
- `/category-remodeling-construction.html`
- `/how-it-works.html`

Páginas com pouca entrada interna:

- `/electrical.html`
- `/handyman.html`
- `/kitchen-remodeling.html`
- vários blogs e local pages com apenas 1 a 4 links internos

Leitura: hoje a malha interna ainda empurra muita autoridade para hubs e quote flows, e menos para money pages locais que deveriam capturar o clique orgânico.

### G.2 Recomendações objetivas de links

| Origem | Destino recomendado | Âncora recomendada | Motivo | Prioridade |
| --- | --- | --- | --- | --- |
| `/index.html` | `/roofing-contractor-riverview-fl.html` | Roofing Contractor in Riverview, FL | Reforçar página com maior tração atual | Alta |
| `/index.html` | `/ac-repair-riverview-fl.html` | AC Repair in Riverview, FL | Aumentar relevância local de HVAC | Alta |
| `/index.html` | `/plumber-riverview-fl.html` | Plumber in Riverview, FL | Empurrar cluster de plumbing | Alta |
| `/services.html` | `/hvac-contractor-riverview-fl.html` | HVAC Contractor in Riverview, FL | Melhorar cluster comercial local | Alta |
| `/services.html` | `/foundation-repair-riverview-fl.html` | Foundation Repair in Riverview, FL | Página estratégica com pouca autoridade | Alta |
| `/areas-we-serve.html` | páginas locais por serviço e cidade | serviço + cidade | Transformar áreas em hub de distribuição real | Alta |
| `/blog-emergency-plumber-riverview-fl.html` | `/plumber-riverview-fl.html` | plumber in Riverview, FL | Transferir intenção informacional para comercial | Alta |
| `/blog-ac-repair-riverview-fl.html` | `/ac-repair-riverview-fl.html` | AC repair in Riverview, FL | Melhorar funil informacional > comercial | Alta |
| `/blog-hvac-contractor-riverview-fl.html` | `/hvac-contractor-riverview-fl.html` | HVAC contractor in Riverview, FL | Consolidar cluster HVAC | Alta |
| `/blog-foundation-warning-signs-florida-homeowners.html` | `/foundation-repair-riverview-fl.html` | foundation repair in Riverview, FL | Levar tráfego de sintoma para money page | Alta |
| Blogs antigos/fracos | `services.html` + local pages | serviço + cidade | Distribuir autoridade e facilitar navegação | Média |
| Hubs principais | quote flows | apenas quando usuário estiver pronto para agir | Reduzir sobrecarga de fluxo no SEO | Média |

## H. Conversão e geração de leads

### H.1 Diagnóstico

Pontos positivos:

- Home atual está mais clara do que versões anteriores.
- Flows têm UX mais compacta do que antes.
- Modelo “describe once” está bem comunicado em páginas novas.
- `thank-you.html` já existe e está funcional.

Pontos que ainda travam lead rate:

| Página/área | Problema | Impacto | Prioridade |
| --- | --- | --- | --- |
| Quote flows | Estão indexáveis e servem também como landing orgânica | Mistura SEO com formulário puro | Crítica |
| Quote flows | CTA final ainda usa `Get My Free Quotes` | Promessa potencialmente mais forte que o modelo real | Média |
| Páginas antigas | Baixa confiança visual, pouco contexto e sem instrumentação | Menor taxa de início de request | Alta |
| Home / hubs | Ainda há muitos caminhos diretos para fluxo e poucos caminhos de “learn then act” | Usuário frio pode não converter | Média |
| Thank-you | Sem evento de sucesso claramente observável | Não fecha funil | Alta |
| Site todo | Não há alternativa óbvia de contato como telefone/WhatsApp visível nas páginas estratégicas | Perda de leads em intenção alta | Média |

### H.2 Recomendações por página

| Página | Recomendação |
| --- | --- |
| `/index.html` | Separar melhor CTAs de “learn” e “request”; destacar mais os 3 serviços com impressões reais. |
| `/services.html` | Reescrever hero e metadados; transformar em hub de descoberta comercial, não só lista de links. |
| `/roofing-contractor-riverview-fl.html` | Manter como template-modelo para demais pages. |
| `/plumber-riverview-fl.html` | Inserir mais CTAs contextuais por sintoma. |
| `/hvac-contractor-riverview-fl.html` | Inserir prova de utilidade por problema: short cycling, humidity, airflow. |
| `/quote-flow-standard.html` | Não usar como página orgânica; manter só para conversão. |
| `/thank-you.html` | Adicionar evento de conversão e micropróximo passo mais explícito. |

## I. Analytics e eventos

### I.1 O que está bom

- GA4 principal está presente em produção.
- Google Ads foi preservado onde já existia.
- Páginas novas usam `data-track` e `data-cta` com mais consistência.

### I.2 O que está faltando

| Item | Situação atual | Recomendação |
| --- | --- | --- |
| Conversão final | Não há confirmação explícita de evento de sucesso no `thank-you.html` | Disparar `lead_submit_success` e `thank_you_view` |
| Passos do flow | Parcial ou não visível em relatório técnico | Padronizar `quote_step_completed` por etapa |
| Páginas antigas | Sem `data-track` | Instrumentar ou remover da arquitetura prioritária |
| Preview/Staging | GA4 real presente | Trocar ID ou remover GA4 nesses ambientes |
| Segmentação por serviço/cidade | Incompleta | Enviar parâmetros como `service_type`, `city`, `flow_type` |

## J. Performance

### J.1 Achados

| Recurso | Tamanho aproximado | Observação | Prioridade |
| --- | --- | --- | --- |
| `/assets/images/service-kitchen.png` | ~2.15 MB | Muito pesado para um ativo de site local | Alta |
| `/assets/images/kitchen-remodel-real.jpeg` | ~399 KB | Ainda pesado para mobile | Média |
| `/assets/images/hero-home-real.jpeg` | ~376 KB | Pode ser otimizado | Média |
| `/assets/service-landing.js` | ~34 KB | Aceitável | Baixa |
| `/assets/platform-forms.js` | ~21 KB | Aceitável | Baixa |
| `/assets/platform.css` | ~19 KB | Aceitável | Baixa |

### J.2 Leitura

O risco principal não está em JS ou CSS. Está em:

- imagens pesadas;
- possível duplicidade de ativos;
- páginas antigas e novas coexistindo com recursos diferentes;
- chance de LCP alto nas páginas com imagem hero.

Recomendações:

1. Inventariar imagens realmente usadas em produção.
2. Converter imagens maiores para versões otimizadas e consistentes.
3. Remover ativos mortos do diretório `assets/images`.

## K. Acessibilidade e qualidade HTML

### K.1 Achados

| Tema | Observação | Arquivos |
| --- | --- | --- |
| H1 ausente | Flows sem H1 | `/quote-flow-standard.html`, `/quote-flow-kitchen.html`, `/quote-flow-house-cleaning.html` |
| Labels de formulário | Presentes nos flows auditados | Bom sinal |
| Alt de imagens | Não foram encontrados `img` sem `alt` nas páginas de produção com imagens | Bom sinal |
| Links claros | Em geral bons nas páginas novas | Médio para bom |
| Páginas antigas | Estrutura visual e semântica inferior | `/bathroom-remodeling.html`, `/drywall.html`, `/electrical.html`, `/flooring-installation.html`, `/handyman.html`, `/kitchen-remodeling.html`, `/painting.html`, `/plumbing.html` |

### K.2 Recomendação

Não há uma crise severa de acessibilidade detectada via leitura estática, mas a qualidade semântica cai bastante nos fluxos e páginas legadas. O trabalho mais importante aqui é:

1. tirar flows da disputa orgânica;
2. elevar headings e semântica das páginas antigas se elas continuarem públicas;
3. revisar contraste e navegação mobile em QA manual real.

## L. Sitemap, robots e indexação

### L.1 Estado atual

| Item | Estado | Observação |
| --- | --- | --- |
| `/robots.txt` | Bom | Libera rastreamento e aponta sitemap |
| `/sitemap.xml` | Bom com ressalvas | Não inclui thank-you nem flows, o que está coerente |
| `www` vs non-www | Bom | Redirect observado em produção |
| `thank-you.html` | Bom | `noindex,follow` e fora do sitemap |
| Preview/Staging | Bom em robots | `noindex,nofollow` presente |
| Quote flows | Ruim | Fora do sitemap, mas com `index,follow` |

### L.2 Correções recomendadas

| Prioridade | Ação | Arquivos |
| --- | --- | --- |
| Crítica | Aplicar `noindex,follow` aos quote flows ou consolidar política equivalente | `/quote-flow-standard.html`, `/quote-flow-kitchen.html`, `/quote-flow-house-cleaning.html` |
| Alta | Corrigir breadcrumb/canonical inconsistentes que usam `/services/` e `/request/` em vez das URLs reais `.html` | Principalmente nos quote flows |
| Média | Revisar se páginas antigas devem permanecer indexáveis | service landers antigos |

## M. Organização do repositório

### M.1 Problemas de manutenção

| Problema | Arquivos / diretórios | Impacto |
| --- | --- | --- |
| README desatualizado e incorreto | `/README.md` | Onboarding técnico errado |
| Múltiplas camadas de produção/preview/staging | `/`, `/preview`, `/staging/platform-phase2` | Aumenta risco de divergência |
| GA4 em ambientes não produtivos | `/preview/**`, `/staging/**` | Dados poluídos |
| Arquitetura híbrida com páginas antigas e novas | raiz do projeto | Dificulta governança e priorização de SEO |
| Diretório `assets/images` com arquivos grandes e potencialmente redundantes | `/assets/images/**` | Débito de performance e manutenção |

### M.2 Arquivos que exigem cuidado especial

- `/api/lead.js`
- `/vercel.json`
- `/sitemap.xml`
- `/robots.txt`
- `/assets/platform-forms.js`
- `/staging/platform-phase2/data/services.json`
- `/staging/platform-phase2/data/blog-articles.json`
- `/staging/platform-phase2/scripts/generate.ps1`

## N. Roadmap 30/60/90 dias

### N.1 Fase 1 — correções críticas técnicas e tracking

| Ação | Arquivos | Impacto esperado | Dificuldade | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Desindexar quote flows | `/quote-flow-standard.html`, `/quote-flow-kitchen.html`, `/quote-flow-house-cleaning.html` | Remove impressões inúteis e limpa sinal orgânico | Baixa | Baixo | Crítica |
| Corrigir canonical e breadcrumbs dos flows | mesmos | Evita inconsistência técnica | Média | Baixo | Crítica |
| Implementar eventos `lead_submit_success` e `thank_you_view` | `/thank-you.html`, `/assets/platform-forms.js` ou equivalente | Fecha funil analítico | Média | Baixo | Alta |
| Remover GA4 real de preview/staging | templates e previews | Limpa analytics | Média | Baixo | Alta |
| Atualizar README | `/README.md` | Melhora manutenção | Baixa | Baixo | Alta |

### N.2 Fase 2 — SEO das páginas com impressões

| Ação | Arquivos | Impacto esperado | Dificuldade | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Continuar reforço em roofing | roofing page + links internos + blogs satélite | Melhor chance de subir página mais promissora | Média | Baixo | Alta |
| Fortalecer plumber page e artigos satélite | `/plumber-riverview-fl.html`, blogs de plumbing | Melhorar cluster já com impressões | Média | Baixo | Alta |
| Completar HVAC/AC schema e links | `/hvac-contractor-riverview-fl.html`, `/ac-repair-riverview-fl.html` | Melhorar riqueza e relevância | Média | Baixo | Alta |

### N.3 Fase 3 — clusters prioritários por intenção comercial

| Ação | Arquivos | Impacto esperado | Dificuldade | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Bathroom cluster moderno | raiz + páginas locais + blogs | Reduz dependência de página antiga rasa | Média | Médio | Alta |
| Flooring cluster moderno | raiz + local + blog | Melhor cobertura comercial e informacional | Média | Médio | Alta |
| Electrical cluster local | páginas locais + blog suporte | Abre novo eixo de alta intenção | Média | Médio | Alta |
| Foundation + Drainage cluster | pages + support posts + links cruzados | Melhor captura de queries sintoma | Média | Médio | Alta |

### N.4 Fase 4 — links internos e arquitetura

| Ação | Arquivos | Impacto esperado | Dificuldade | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Rebalancear links da home | `/index.html` | Mais autoridade para money pages | Média | Baixo | Alta |
| Reestruturar `services.html` como hub real | `/services.html` | Melhor UX + SEO | Média | Baixo | Alta |
| Usar `areas-we-serve.html` como hub local de distribuição | `/areas-we-serve.html` | Fortalece cluster por cidade | Média | Baixo | Alta |

### N.5 Fase 5 — conversão e GA4

| Ação | Arquivos | Impacto esperado | Dificuldade | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Instrumentar eventos do flow | flows + JS | Melhor leitura de abandono | Média | Baixo | Alta |
| Refinar microcopy de submit | flows | Menos atrito de promessa | Baixa | Baixo | Média |
| Inserir alternativas de contato em páginas quentes | páginas comerciais principais | Pode aumentar lead rate | Média | Médio | Média |

### N.6 Fase 6 — autoridade local, backlinks e citations

| Ação | Arquivos | Impacto esperado | Dificuldade | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Criar assets/linkables locais | novos blogs/guias | Aumenta chance de backlinks úteis | Média | Médio | Média |
| Citations e perfis locais | fora do repositório | Ajuda autoridade local | Alta | Médio | Média |

### N.7 Fase 7 — performance e limpeza

| Ação | Arquivos | Impacto esperado | Dificuldade | Risco | Prioridade |
| --- | --- | --- | --- | --- | --- |
| Otimizar imagens pesadas | `/assets/images/**` | Melhora CWV | Média | Baixo | Média |
| Inventariar e remover assets mortos | `/assets/**` | Simplifica manutenção | Média | Médio | Média |
| Revisar coexistência de páginas antigas e novas | raiz do projeto | Menos canibalização e dívida | Alta | Médio | Alta |

## O. Lista priorizada de ações

### Crítica

1. Desindexar os três quote flows.
2. Corrigir canonical e breadcrumb dos quote flows para não apontarem a URLs fantasmas.
3. Resolver a duplicidade entre `/kitchen-remodeling.html` e `/service-kitchen-remodeling.html`.

### Alta

1. Reescrever ou aposentar páginas antigas sem schema e sem tracking.
2. Completar schema das páginas locais novas mais estratégicas.
3. Implementar eventos reais de conversão no thank-you e nos flows.
4. Tirar GA4 real de preview e staging.
5. Reescrever `services.html` como hub comercial mais forte.
6. Atualizar README para a arquitetura real.

### Média

1. Otimizar imagens pesadas.
2. Aumentar interlinking para plumber, HVAC, foundation, drainage e electrical.
3. Refinar CTA/microcopy dos fluxos para prometer “free to use”, não “free estimates” em todo contexto.
4. Expandir cluster de House Cleaning com página orgânica forte.

### Baixa

1. Ajustes finos de meta descriptions muito longas em blogs.
2. Harmonização visual e semântica de páginas legadas enquanto não forem migradas.

## P. Próximos prompts recomendados para execução

### Prompt 1 — correção crítica de indexação

> No repositório `cosaqdigital/getestimatefast-v2`, crie uma branch `fix/noindex-quote-flows` e faça somente correções técnicas nos arquivos `quote-flow-standard.html`, `quote-flow-kitchen.html` e `quote-flow-house-cleaning.html` para remover essas páginas da indexação orgânica. Ajuste `robots` para `noindex,follow`, corrija `canonical`, remova breadcrumbs inconsistentes se necessário e preserve formulários, GA4, `/api/lead`, layout e CTA. Depois valide e abra PR sem merge.

### Prompt 2 — consolidação do cluster kitchen

> No repositório `cosaqdigital/getestimatefast-v2`, audite e corrija a canibalização entre `kitchen-remodeling.html` e `service-kitchen-remodeling.html`. Defina qual será a money page principal, diferencie titles/canonicals ou consolide a estratégia, preserve formulários e não altere `/api/lead`. Entregue PR sem merge.

### Prompt 3 — modernização das páginas antigas

> No repositório `cosaqdigital/getestimatefast-v2`, modernize estas páginas antigas sem alterar a lógica de envio: `bathroom-remodeling.html`, `flooring-installation.html`, `painting.html`, `drywall.html`, `plumbing.html`, `electrical.html`, `handyman.html`. Adicione metadados fortes, schema básico, tracking `data-track`, melhor CTA e copy mais confiável, preservando o design atual o máximo possível.

### Prompt 4 — tracking de conversão

> No repositório `cosaqdigital/getestimatefast-v2`, implemente eventos GA4 completos para `cta_click`, `service_selected`, `start_quote_flow`, `quote_step_completed`, `form_submit_attempt`, `lead_submit_success` e `thank_you_view`, preservando G-D4PB807CDR, sem alterar `/api/lead` além do estritamente necessário e sem quebrar os formulários.

### Prompt 5 — reforço do cluster de maior potencial

> No repositório `cosaqdigital/getestimatefast-v2`, trabalhe somente no cluster Roofing para aumentar CTR e relevância local. Expanda `roofing-contractor-riverview-fl.html`, fortaleça links em `index.html` e `services.html`, e crie 2 artigos satélite adicionais focados em roof leak e storm damage em Riverview, sem alterar analytics, forms ou `/api/lead`.

### Prompt 6 — limpeza de analytics em preview/staging

> No repositório `cosaqdigital/getestimatefast-v2`, remova ou isole o GA4 de produção das páginas em `/preview/**` e `/staging/platform-phase2/**`, mantendo `noindex,nofollow` e sem tocar nas páginas publicadas da raiz.

## Conclusão

O GetEstimateFast já tem sinais reais de demanda orgânica. O problema não é ausência de mercado. O problema é que o site ainda mistura camadas demais: páginas antigas, páginas novas, flows indexáveis, clusters incompletos e tracking insuficiente. A boa notícia é que os caminhos de crescimento já aparecem com clareza no dado atual. Roofing, plumbing, HVAC/AC e foundation/drainage já mostram onde vale concentrar energia. Se as correções críticas forem feitas primeiro, o site tende a ganhar qualidade de indexação, CTR e taxa de aprendizado muito mais rápido.
