# GFSEO-EXEC-001 - Fundacao Tecnica SEO

Versao: 1.0  
Status: Aprovado  
Sistema: GF-OS  
Projeto: GetEstimateFast  
Tipo: Plano de Execucao SEO  

---

## 1. Finalidade

O documento GFSEO-EXEC-001 define a primeira sprint pratica de SEO do GetEstimateFast apos a conclusao da base documental do GF-OS.

Seu objetivo e fortalecer a base tecnica do site atual para preparar o crescimento organico, melhorar indexacao e aumentar as chances de ranqueamento local em Riverview, Tampa Bay e cidades proximas.

Este documento marca a mudanca de foco do projeto: de documentacao corporativa para execucao pratica orientada a SEO, trafego organico e geracao de leads.

---

## 2. Contexto

O site GetEstimateFast ja esta online e ja captou pelo menos um lead, mas ainda esta distante das primeiras posicoes do Google.

A prioridade atual nao e construir login, CRM ou painel administrativo complexo. A prioridade e validar demanda com trafego organico, fortalecer a autoridade local e aumentar a quantidade de leads qualificados.

O GF-OS permanece como especificacao oficial de longo prazo, mas a execucao imediata deve priorizar crescimento saudavel do site.

---

## 3. Objetivo da Sprint

Fortalecer a base tecnica de SEO do site atual sem alterar layout, sem criar novas paginas e sem modificar a proposta comercial principal.

A sprint deve resolver os problemas P0 identificados na auditoria tecnica inicial.

---

## 4. Escopo da Sprint

### 4.1 Sitemap

Corrigir o sitemap.xml para utilizar exclusivamente o host oficial:

```text
https://www.getestimatefast.com/
```

O sitemap deve estar consistente com canonicals e URLs publicas do site.

### 4.2 Remocao de pagina utilitaria

Remover thank-you.html do sitemap.

A pagina de obrigado e utilitaria e nao deve ser tratada como pagina estrategica de indexacao organica.

### 4.3 Robots.txt

Criar o arquivo robots.txt seguindo boas praticas basicas de indexacao.

O arquivo deve permitir rastreamento das paginas publicas importantes e apontar para o sitemap oficial.

### 4.4 Canonical e og:url

Padronizar canonical, og:url e sitemap para o mesmo dominio oficial:

```text
https://www.getestimatefast.com/
```

### 4.5 Schema markup

Adicionar JSON-LD nas paginas de servico que ainda nao possuem schema.

Padrao minimo recomendado:

- WebPage;
- Service;
- dados basicos de area atendida;
- nome do servico;
- URL canonica.

### 4.6 Encoding

Corrigir pequenos problemas de caracteres quebrados identificados na auditoria.

Exemplos:

- caracteres estranhos em bullet points;
- simbolos quebrados;
- textos com encoding incorreto.

---

## 5. Fora de Escopo

Esta sprint nao deve:

- alterar layout;
- reescrever textos comerciais;
- criar novas paginas;
- alterar URLs existentes;
- criar login;
- criar CRM;
- criar painel administrativo;
- alterar estrategia de produto;
- implementar clusters locais ainda.

---

## 6. Arquivos Provaveis

Arquivos que podem precisar de alteracao:

- sitemap.xml;
- robots.txt;
- index.html;
- bathroom-remodeling.html;
- drywall.html;
- electrical.html;
- flooring-installation.html;
- handyman.html;
- kitchen-remodeling.html;
- painting.html;
- plumbing.html;
- thank-you.html.

---

## 7. Prompt Oficial para Codex

```text
SPRINT SEO 001 - Fundacao Tecnica

Objetivo:
Fortalecer a base tecnica do GetEstimateFast para preparar o crescimento organico.

Implementar apenas as melhorias P0 identificadas na auditoria.

Escopo:

1. Corrigir sitemap.xml para utilizar exclusivamente:
https://www.getestimatefast.com/

2. Remover thank-you.html do sitemap.

3. Criar robots.txt seguindo boas praticas para indexacao.

4. Padronizar canonical, og:url e sitemap para o mesmo dominio.

5. Adicionar JSON-LD Schema nas paginas de servico que ainda nao possuem.
Utilizar WebPage + Service conforme apropriado.

6. Corrigir pequenos problemas de encoding encontrados.

Nao alterar layout.
Nao alterar textos comerciais.
Nao criar novas paginas.
Nao alterar URLs.

Ao finalizar:
- listar todos os arquivos modificados;
- explicar resumidamente cada alteracao;
- nao realizar commit.
```

---

## 8. Criterios de Aceitacao

A sprint sera considerada concluida quando:

- sitemap estiver usando o dominio oficial com www;
- thank-you.html nao estiver no sitemap;
- robots.txt existir e apontar para o sitemap;
- canonical, og:url e sitemap estiverem consistentes;
- paginas de servico principais tiverem schema basico;
- problemas evidentes de encoding forem corrigidos;
- nenhuma pagina nova tiver sido criada;
- nenhum layout tiver sido alterado.

---

## 9. Proxima Sprint

Apos a conclusao desta sprint, a proxima etapa sera:

```text
GFSEO-EXEC-002 - Cluster Local de Bathroom Remodeling
```

Essa proxima sprint iniciara a expansao estrategica de conteudo com foco em:

- Bathroom Remodeling Riverview;
- Bathroom Remodeling Brandon;
- Bathroom Remodeling Valrico;
- Bathroom Remodeling Fish Hawk;
- Bathroom Remodeling Apollo Beach.

---

## 10. Conclusao

O GFSEO-EXEC-001 estabelece o primeiro passo pratico para crescimento organico do GetEstimateFast.

A meta nao e construir funcionalidades complexas neste momento, mas preparar o site atual para indexacao mais consistente, autoridade tecnica e crescimento sustentavel no Google.

A partir deste documento, o foco operacional passa a ser simples: toda acao deve aumentar a chance de ranquear melhor, atrair visitantes qualificados e gerar leads reais.