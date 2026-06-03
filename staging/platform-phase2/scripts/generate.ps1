$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root "data"
$templateDir = Join-Path $root "templates"
$generatedDir = Join-Path $root "generated-pages"

if (!(Test-Path $generatedDir)) {
  New-Item -ItemType Directory -Path $generatedDir | Out-Null
} else {
  Get-ChildItem -Path $generatedDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
}

New-Item -ItemType Directory -Path (Join-Path $generatedDir "assets\\images") -Force | Out-Null
Copy-Item -Path (Join-Path $root "assets\\platform.css") -Destination (Join-Path $generatedDir "assets\\platform.css") -Force
Copy-Item -Path (Join-Path $root "assets\\platform-forms.js") -Destination (Join-Path $generatedDir "assets\\platform-forms.js") -Force
Copy-Item -Path (Join-Path $root "assets\\images\\*") -Destination (Join-Path $generatedDir "assets\\images") -Recurse -Force

function Load-JsonFile {
  param([string]$Name)
  return Get-Content (Join-Path $dataDir $Name) -Raw | ConvertFrom-Json
}

$site = Load-JsonFile "site.json"
$categories = Load-JsonFile "categories.json"
$services = Load-JsonFile "services.json"
$cities = Load-JsonFile "cities.json"
$faqs = Load-JsonFile "faqs.json"
$nearbyRelations = Load-JsonFile "nearby-city-relationships.json"
$trustBlocks = Load-JsonFile "trust-blocks.json"
$flows = Load-JsonFile "flows.json"
$localSeoPages = Load-JsonFile "local-seo-pages.json"
$blogArticles = Load-JsonFile "blog-articles.json"

$categoryMap = @{}
$categories | ForEach-Object { $categoryMap[$_.key] = $_ }
$serviceMap = @{}
$services | ForEach-Object { $serviceMap[$_.key] = $_ }
$cityMap = @{}
$cities | ForEach-Object { $cityMap[$_.key] = $_ }
$localSeoPageMap = @{}
$localSeoPages | ForEach-Object { $localSeoPageMap["$($_.serviceKey)|$($_.cityKey)"] = $_ }

$activeServices = @($services | Where-Object { $_.status -eq "active" })
$activeStandardServices = @($activeServices | Where-Object { $_.requestFlow -eq "standard" })
$standardServiceLabels = @($activeStandardServices | ForEach-Object { $_.label })

if ($flows.standard -and $flows.standard.steps.Count -gt 0) {
  $flows.standard.serviceOptions = $standardServiceLabels
  $flows.standard.steps[0].options = $standardServiceLabels
}

function Get-DataValue {
  param($Object, [string]$Key)
  $property = $Object.PSObject.Properties[$Key]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Get-ServiceKeywords {
  param($Service)

  $keywords = @()

  if ($null -ne $Service.PSObject.Properties["searchKeywords"] -and $Service.searchKeywords) {
    $keywords += @($Service.searchKeywords)
  }

  $keywords += $Service.label
  $keywords += ($Service.slug -replace "-", " ")

  return @($keywords | Where-Object { $_ } | Select-Object -Unique)
}

function Get-LocalSeoLinkLabel {
  param($Page)

  if ($Page.title) {
    return ($Page.title -replace '\s+\|\s+.+$','')
  }

  return $Page.h1
}

function Resolve-LocalSeoPage {
  param(
    [string]$ServiceKey,
    [string]$CityKey
  )

  $lookupKey = "$ServiceKey|$CityKey"
  if ($localSeoPageMap.ContainsKey($lookupKey)) {
    return $localSeoPageMap[$lookupKey]
  }

  return $null
}

function Html-Escape {
  param([string]$Value)
  if ($null -eq $Value) { return "" }
  return [System.Net.WebUtility]::HtmlEncode($Value)
}

function New-JsonLdScript {
  param($Object)
  return "<script type=""application/ld+json"">" + ([Environment]::NewLine) + (($Object | ConvertTo-Json -Depth 40 -Compress) -replace "><", "><") + ([Environment]::NewLine) + "</script>"
}

function New-BreadcrumbSchema {
  param(
    [array]$Items
  )

  $listItems = @()
  for ($i = 0; $i -lt $Items.Count; $i++) {
    $listItems += [pscustomobject]@{
      "@type"    = "ListItem"
      position   = $i + 1
      name       = $Items[$i].name
      item       = $Items[$i].url
    }
  }

  return New-JsonLdScript ([pscustomobject]@{
      "@context"        = "https://schema.org"
      "@type"           = "BreadcrumbList"
      itemListElement   = $listItems
    })
}

function New-FaqSchema {
  param([array]$Items)
  return New-JsonLdScript ([pscustomobject]@{
      "@context"  = "https://schema.org"
      "@type"     = "FAQPage"
      mainEntity  = @(
        $Items | ForEach-Object {
          [pscustomobject]@{
            "@type" = "Question"
            name = $_.question
            acceptedAnswer = [pscustomobject]@{
              "@type" = "Answer"
              text = $_.answer
            }
          }
        }
      )
    })
}

function New-WebPageSchema {
  param(
    [string]$Name,
    [string]$Description,
    [string]$Canonical
  )

  return New-JsonLdScript ([pscustomobject]@{
      "@context"    = "https://schema.org"
      "@type"       = "WebPage"
      name          = $Name
      description   = $Description
      url           = $Canonical
      isPartOf      = [pscustomobject]@{
        "@type" = "WebSite"
        name    = $site.name
        url     = "$($site.baseUrl)/"
      }
      publisher     = [pscustomobject]@{
        "@type" = "Organization"
        name    = $site.name
        url     = "$($site.baseUrl)/"
      }
    })
}

function New-ArticleSchema {
  param(
    [string]$Headline,
    [string]$Description,
    [string]$Canonical,
    [string]$Category
  )

  return New-JsonLdScript ([pscustomobject]@{
      "@context"         = "https://schema.org"
      "@type"            = "Article"
      headline           = $Headline
      description        = $Description
      articleSection     = $Category
      mainEntityOfPage   = [pscustomobject]@{
        "@type" = "WebPage"
        "@id"   = $Canonical
      }
      author             = [pscustomobject]@{
        "@type" = "Organization"
        name    = $site.name
      }
      publisher          = [pscustomobject]@{
        "@type" = "Organization"
        name    = $site.name
        url     = "$($site.baseUrl)/"
      }
      url                = $Canonical
    })
}

function Render-BasePage {
  param(
    [string]$Title,
    [string]$MetaDescription,
    [string]$Canonical,
    [string]$Robots,
    [string]$Schema,
    [string]$Body
  )

  $template = Get-Content (Join-Path $templateDir "base-page.html") -Raw
  $template = $template.Replace("{{TITLE}}", $Title)
  $template = $template.Replace("{{META_DESCRIPTION}}", $MetaDescription)
  $template = $template.Replace("{{CANONICAL}}", $Canonical)
  $template = $template.Replace("{{ROBOTS}}", $Robots)
  $template = $template.Replace("{{SCHEMA}}", $Schema)
  $template = $template.Replace("{{BODY}}", $Body)
  return $template
}

function Render-FlowPage {
  param(
    [string]$Title,
    [string]$MetaDescription,
    [string]$Canonical,
    [string]$Robots,
    [string]$Schema,
    [string]$Body,
    [string]$FlowConfigJson
  )

  $template = Get-Content (Join-Path $templateDir "flow-page.html") -Raw
  $template = $template.Replace("{{TITLE}}", $Title)
  $template = $template.Replace("{{META_DESCRIPTION}}", $MetaDescription)
  $template = $template.Replace("{{CANONICAL}}", $Canonical)
  $template = $template.Replace("{{ROBOTS}}", $Robots)
  $template = $template.Replace("{{SCHEMA}}", $Schema)
  $template = $template.Replace("{{BODY}}", $Body)
  $template = $template.Replace("{{FLOW_CONFIG}}", $FlowConfigJson)
  return $template
}

function Render-Header {
  param([string]$ctaHref)
  return @"
<header class="site-header">
  <div class="container">
    <div class="header-inner">
      <div class="brand-block">
        <a class="brand" href="index.html">$($site.name)</a>
        <span class="brand-pill"><strong>Free</strong> to use for homeowners and businesses</span>
      </div>
      <nav class="nav">
        <a class="nav-link" href="services.html" data-track="nav-link" data-cta="services-nav">Services</a>
        <a class="nav-link" href="blog.html" data-track="nav-link" data-cta="blog-nav">Blog</a>
        <a class="nav-link" href="category-remodeling-construction.html" data-track="nav-link" data-cta="remodeling-nav">Remodeling</a>
        <a class="nav-link" href="service-kitchen-remodeling.html" data-track="nav-link" data-cta="kitchen-nav" data-service="kitchen-remodeling">Kitchen Remodeling</a>
        <a class="btn btn-primary" href="$ctaHref" data-track="header-cta" data-cta="start-my-request">Start My Request</a>
      </nav>
    </div>
  </div>
</header>
"@
}

function Render-HomeHeader {
  return @"
<header class="site-header home-header">
  <div class="container">
    <div class="header-inner">
      <a class="brand" href="index.html">$($site.name)</a>
      <nav class="nav">
        <a class="nav-link" href="services.html" data-track="nav-link" data-cta="services-nav">Services</a>
        <a class="nav-link" href="blog.html" data-track="nav-link" data-cta="blog-nav">Blog</a>
        <a class="nav-link" href="how-it-works.html" data-track="nav-link" data-cta="how-it-works-nav">How it Works</a>
        <a class="nav-link" href="areas-we-serve.html" data-track="nav-link" data-cta="areas-nav">Areas</a>
        <a class="btn btn-header" href="services.html" data-track="header-cta" data-cta="start-my-request">Start My Request</a>
      </nav>
    </div>
  </div>
</header>
"@
}

function Render-FlowHeader {
  return @"
<header class="site-header flow-header">
  <div class="container">
    <div class="header-inner flow-header-inner">
      <a class="brand" href="index.html">$($site.name)</a>
      <nav class="nav flow-nav">
        <a class="nav-link" href="index.html" data-track="nav-link" data-cta="flow-home-nav">Home</a>
        <a class="nav-link" href="services.html" data-track="nav-link" data-cta="flow-services-nav">Services</a>
      </nav>
    </div>
  </div>
</header>
"@
}

function Render-Footer {
  return @"
<footer class="footer">
  <div class="container">
    <div class="panel">
      <div class="footer-links">
        <a href="index.html">Home</a>
        <a href="services.html">Services</a>
        <a href="blog.html">Blog</a>
        <a href="category-remodeling-construction.html">Remodeling &amp; Construction</a>
        <a href="service-kitchen-remodeling.html">Kitchen Remodeling</a>
        <a href="areas-we-serve.html">Areas We Serve</a>
        <a href="how-it-works.html">How It Works</a>
      </div>
      <div class="footer-note">$($site.name) helps homeowners and businesses connect with local professionals across $($site.region). We do not perform the services directly. Availability, pricing, and response times may vary by provider, project type, and service area.</div>
    </div>
  </div>
</footer>
"@
}

function Render-BreadcrumbsHtml {
  param([array]$Items)
  return (
    '<div class="breadcrumbs">' +
    (($Items | ForEach-Object {
      if ($_.href) { "<a href=""$($_.href)"">$($_.label)</a>" } else { "<span>$($_.label)</span>" }
    }) -join '<span>/</span>') +
    '</div>'
  )
}

function Render-Pills {
  param(
    [array]$Items,
    [string]$ClassName
  )
  return ($Items | ForEach-Object { "<span class=""$ClassName"">$(Html-Escape $_)</span>" }) -join ""
}

function Render-Cards {
  param([array]$Cards)
  return ($Cards | ForEach-Object {
    $statusLabel = if ($_.status) { Resolve-ServiceStatusLabel $_.status } else { "" }
    $statusClass = if ($_.status -eq "active") { "service-status service-status-active" } else { "service-status" }
    $trackAttr = if ($_.track) { $_.track } else { "card" }
    $ctaAttr = if ($_.ctaTrack) { $_.ctaTrack } else { "card-cta" }
    $serviceAttr = if ($_.serviceKey) { " data-service=""$($_.serviceKey)""" } else { "" }
    $cityAttr = if ($_.cityKey) { " data-city=""$($_.cityKey)""" } else { "" }
    $badgeMarkup = if ($statusLabel) { "<span class=""$statusClass"">$statusLabel</span>" } else { "" }
    if ($_.disabled) {
@"
<article class="card card-disabled" data-track="$trackAttr" data-cta="$ctaAttr"$serviceAttr$cityAttr>
  $(if ($_.image) { "<img src=""$($_.image)"" alt=""$($_.alt)"">" } else { "" })
  $(if ($badgeMarkup) { "<div class=""card-meta"">$badgeMarkup</div>" } else { "" })
  <h3>$(Html-Escape $_.title)</h3>
  <p>$(Html-Escape $_.text)</p>
  <span class="btn btn-muted">$($_.cta)</span>
</article>
"@
    } else {
@"
<a class="card" href="$($_.href)" data-track="$trackAttr" data-cta="$ctaAttr"$serviceAttr$cityAttr>
  $(if ($_.image) { "<img src=""$($_.image)"" alt=""$($_.alt)"">" } else { "" })
  $(if ($badgeMarkup) { "<div class=""card-meta"">$badgeMarkup</div>" } else { "" })
  <h3>$(Html-Escape $_.title)</h3>
  <p>$(Html-Escape $_.text)</p>
  <span class="btn btn-primary">$($_.cta)</span>
</a>
"@
    }
  }) -join ""
}

function Render-FaqList {
  param([array]$Items)
  return ($Items | ForEach-Object { "<div class=""faq-item""><h3>$(Html-Escape $_.question)</h3><p>$(Html-Escape $_.answer)</p></div>" }) -join ""
}

function Render-TrustCards {
  param([array]$Items)
  return ($Items | ForEach-Object {
    "<div class=""trust-card""><h3>$(Html-Escape $_.title)</h3><p>$(Html-Escape $_.text)</p></div>"
  }) -join ""
}

function Render-ListItems {
  param([array]$Items)
  return ($Items | ForEach-Object { "<li>$(Html-Escape $_)</li>" }) -join ""
}

function Render-ArticleSections {
  param([array]$Sections)

  return ($Sections | ForEach-Object {
    $section = $_
    $paragraphMarkup = (($section.paragraphs | ForEach-Object { "<p>$(Html-Escape $_)</p>" }) -join "")
    $listMarkup = ""
    if ($section.listItems) {
      $listMarkup = "<ul>" + (Render-ListItems $section.listItems) + "</ul>"
    }
    "<section class=""article-section""><h2>$(Html-Escape $section.heading)</h2>$paragraphMarkup$listMarkup</section>"
  }) -join ""
}

function Resolve-CategoryHref {
  param([string]$CategoryKey)
  if ($CategoryKey -eq "remodeling-construction") { return "category-remodeling-construction.html" }
  return "services.html#category-$CategoryKey"
}

# Link resolution stays conservative in Phase 2.1:
# only fully implemented services should behave like real CTAs.
function Resolve-ServiceHref {
  param([string]$ServiceKey)
  $service = $serviceMap[$ServiceKey]
  if ($null -eq $service) { return "services.html" }
  switch ($service.requestFlow) {
    "premium" {
      if ($ServiceKey -eq "kitchen-remodeling") { return "service-kitchen-remodeling.html" }
      if ($ServiceKey -eq "house-cleaning") { return "quote-flow-house-cleaning.html" }
    }
    "standard" { return "quote-flow-standard.html?service=$($service.slug)" }
    default { return "services.html#service-$ServiceKey" }
  }
  return "services.html"
}

function Resolve-ServiceCtaHref {
  param([string]$ServiceKey)
  $service = $serviceMap[$ServiceKey]
  if ($null -eq $service) { return "services.html" }
  switch ($service.requestFlow) {
    "premium" {
      if ($ServiceKey -eq "kitchen-remodeling") { return "quote-flow-kitchen.html" }
      if ($ServiceKey -eq "house-cleaning") { return "quote-flow-house-cleaning.html" }
    }
    "standard" { return "quote-flow-standard.html?service=$($service.slug)" }
  }
  return "services.html"
}

function To-Slug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant()
  $slug = $slug -replace "[^a-z0-9]+", "-"
  $slug = $slug.Trim("-")
  return $slug
}

function Resolve-ServiceStatusLabel {
  param([string]$Status)
  switch ($Status) {
    "active" { return "Active now" }
    "planned" { return "More soon" }
    "coming-soon" { return "More soon" }
    default { return "" }
  }
}

function Find-ServiceByDisplayLabel {
  param([string]$Label)
  $slug = To-Slug $Label
  return $services | Where-Object { $_.slug -eq $slug -or $_.key -eq $slug -or (To-Slug $_.label) -eq $slug } | Select-Object -First 1
}

function Render-ServiceHubChip {
  param([string]$Label)
  $service = Find-ServiceByDisplayLabel $Label
  $slug = To-Slug $Label

  if ($service -and $service.status -eq "active") {
    return "<a class=""service-link is-active"" id=""service-$slug"" href=""$(Resolve-ServiceHref $service.key)"" data-track=""service-link"" data-cta=""active-service-chip"" data-service=""$($service.key)"">$Label<span class=""service-status service-status-active"">Active now</span></a>"
  }

  return "<span class=""service-link is-coming-soon"" id=""service-$slug"" aria-disabled=""true"" data-track=""service-link"" data-cta=""coming-soon-service-chip"" data-service=""$slug"">$Label<span class=""service-status"">More soon</span></span>"
}

function Write-GeneratedFile {
  param([string]$FileName, [string]$Content)
  Set-Content -Path (Join-Path $generatedDir $FileName) -Value $Content -Encoding UTF8
}

function New-OrganizationSchema {
  return New-JsonLdScript ([pscustomobject]@{
      "@context" = "https://schema.org"
      "@type" = "Organization"
      name = $site.name
      url = "$($site.baseUrl)/"
      description = $site.websiteDescription
      areaServed = $site.region
      contactPoint = [pscustomobject]@{
        "@type" = "ContactPoint"
        contactType = "customer support"
        email = $site.email
        telephone = $site.phoneHref
      }
    })
}

function New-WebsiteSchema {
  return New-JsonLdScript ([pscustomobject]@{
      "@context" = "https://schema.org"
      "@type" = "WebSite"
      name = $site.name
      url = "$($site.baseUrl)/"
      description = $site.websiteDescription
    })
}

function New-CollectionPageSchema {
  param([string]$Name, [string]$Description, [string]$Canonical)
  return New-JsonLdScript ([pscustomobject]@{
      "@context" = "https://schema.org"
      "@type" = "CollectionPage"
      name = $Name
      description = $Description
      url = $Canonical
    })
}

function New-ServiceSchema {
  param(
    $Service,
    [string]$Canonical,
    [string]$AreaLabel,
    [string]$Description,
    [string]$NameOverride
  )

  $obj = [ordered]@{
    "@context" = "https://schema.org"
    "@type" = "Service"
    name = $(if ($NameOverride) { $NameOverride } else { $Service.label })
    serviceType = $(if ($NameOverride) { $NameOverride } else { $Service.label })
    provider = [pscustomobject]@{
      "@type" = "Organization"
      name = $site.name
      url = "$($site.baseUrl)/"
    }
    url = $Canonical
    description = $(if ($Description) { $Description } else { $Service.metaDescription })
  }

  if ($AreaLabel) {
    $obj.areaServed = $AreaLabel
  }

  return New-JsonLdScript ([pscustomobject]$obj)
}

function Render-HowItWorksCards {
  return @"
<div class="callout-row">
  <div class="callout-card">
    <h3>Choose the service</h3>
    <p>Start with the type of work you need so the request reaches the right local professionals.</p>
  </div>
  <div class="callout-card">
    <h3>Share the right details</h3>
    <p>Guided questions help professionals understand scope, timing, and location before reaching out.</p>
  </div>
  <div class="callout-card">
    <h3>Compare local professionals</h3>
    <p>Matched professionals can respond with more context when the request already explains the project clearly.</p>
  </div>
</div>
"@
}

function Render-HomeHowItWorksCards {
  return @"
<div class="callout-row home-steps">
  <div class="callout-card">
    <h3>Describe your project</h3>
    <p>Tell us what you need and share the details that matter.</p>
  </div>
  <div class="callout-card">
    <h3>Get matched locally</h3>
    <p>We help connect your request with local professionals serving your area.</p>
  </div>
  <div class="callout-card">
    <h3>Compare your options</h3>
    <p>Review responses and choose what works best for you. No obligation.</p>
  </div>
</div>
"@
}

function Render-HomeCategoryGrid {
  param([array]$Items)
  return ($Items | ForEach-Object {
@"
<a class="category-link" href="$($_.href)" data-track="browse_services" data-cta="$($_.ctaTrack)">
  <h3>$(Html-Escape $_.title)</h3>
  <p>$(Html-Escape $_.text)</p>
</a>
"@
  }) -join ""
}

function Render-FlowStep {
  param(
    $Flow,
    $Step,
    [int]$Index
  )

  $descriptionBlock = ""
  if ($Step.includeDescription) {
    $descriptionBlock = @"
<div style="margin-top:18px;">
  <label class="field-label" for="description-$Index">$($Flow.descriptionPrompt)</label>
  <textarea id="description-$Index" name="Project Description" placeholder="$($Flow.descriptionPlaceholder)"></textarea>
  <div class="hint">A short description helps professionals understand the request before they contact you.</div>
</div>
"@
  }

  if ($Step.type -eq "single") {
    $conditionalMarkup = ""
    if ($Step.conditional) {
      $conditionalMarkup = @"
<div id="conditional-$Index" class="detail-card" style="margin-top:16px; display:none;">
  <p class="step-help" style="margin-bottom:14px;">$($Step.conditional.title)</p>
  <input type="hidden" name="$($Step.conditional.field)" id="conditional-field-$Index" />
  <div class="option-grid two-col" data-conditional-group="$Index">
    $(($Step.conditional.options | ForEach-Object { "<button type=""button"" class=""option-btn"" data-target=""conditional-field-$Index"" data-value=""$_"">$_</button>" }) -join "")
  </div>
</div>
"@
    }

    return @"
<section class="step" data-step="$Index">
  <h2>$($Step.title)</h2>
  <p class="step-help">$($Step.help)</p>
  <input type="hidden" name="$($Step.field)" id="field-$Index" />
  <div class="option-grid $(if ($Step.options.Count -gt 6) { "three-col" } else { "two-col" })" data-single-group="$Index">
    $(($Step.options | ForEach-Object { "<button type=""button"" class=""option-btn"" data-target=""field-$Index"" data-value=""$_"">$_</button>" }) -join "")
  </div>
  $conditionalMarkup
  $descriptionBlock
  <div class="nav-row">
    $(if ($Index -gt 0) { '<button type="button" class="nav-btn secondary" data-back>Back</button>' } else { "" })
    <button type="button" class="nav-btn" data-next>Continue</button>
  </div>
  <div class="error"></div>
</section>
"@
  }

  if ($Step.type -eq "multi") {
    return @"
<section class="step" data-step="$Index">
  <h2>$($Step.title)</h2>
  <p class="step-help">$($Step.help)</p>
  <div class="option-grid three-col">
    $(($Step.options | ForEach-Object {
@"
<label class="checkbox-item">
  <input type="checkbox" name="$($Step.field)" value="$_" />
  <span>$_</span>
</label>
"@
    }) -join "")
  </div>
  <div class="nav-row">
    $(if ($Index -gt 0) { '<button type="button" class="nav-btn secondary" data-back>Back</button>' } else { "" })
    <button type="button" class="nav-btn" data-next>Continue</button>
  </div>
  <div class="error"></div>
</section>
"@
  }

  if ($Step.type -eq "textarea") {
    return @"
<section class="step" data-step="$Index">
  <h2>$($Step.title)</h2>
  <p class="step-help">$($Step.help)</p>
  <label class="field-label" for="textarea-$Index">$($flow.descriptionPrompt)</label>
  <textarea id="textarea-$Index" name="Project Description" placeholder="$($flow.descriptionPlaceholder)"></textarea>
  <div class="hint">A short note is enough. Clear basics now can reduce follow-up questions later.</div>
  <div class="nav-row">
    $(if ($Index -gt 0) { '<button type="button" class="nav-btn secondary" data-back>Back</button>' } else { "" })
    <button type="button" class="nav-btn" data-next>Continue</button>
  </div>
  <div class="error"></div>
</section>
"@
  }

  if ($Step.type -eq "photos") {
    return @"
<section class="step" data-step="$Index">
  <h2>$($Step.title)</h2>
  <p class="step-help">$($Step.help)</p>
  <div class="upload-box">
    <strong>Upload up to 3 photos</strong>
    <div class="hint">Photos are optional, but they can help professionals understand the layout and provide better estimates.</div>
    <div class="photo-grid" style="margin-top:14px;">
      $(1..3 | ForEach-Object {
@"
<div class="photo-field">
  <label class="field-label" for="photo-$_">Photo $_</label>
  <input id="photo-$_" type="file" name="Photo $_" accept="image/*" />
  <span class="photo-file-name"></span>
</div>
"@
      } | Out-String)
    </div>
  </div>
  <div class="nav-row">
    $(if ($Index -gt 0) { '<button type="button" class="nav-btn secondary" data-back>Back</button>' } else { "" })
    <button type="button" class="nav-btn" data-next>Continue</button>
  </div>
  <div class="error"></div>
</section>
"@
  }

  if ($Step.type -eq "location") {
    return @"
<section class="step" data-step="$Index">
  <h2>$($Step.title)</h2>
  <p class="step-help">$($Step.help)</p>
  <div class="field-grid two-col">
    <div>
      <label class="field-label" for="city">City</label>
      <input id="city" name="City" type="text" placeholder="City" />
    </div>
    <div>
      <label class="field-label" for="zip">ZIP Code</label>
      <input id="zip" name="ZIP Code" type="text" inputmode="numeric" placeholder="ZIP Code" />
    </div>
  </div>
  <div class="nav-row">
    $(if ($Index -gt 0) { '<button type="button" class="nav-btn secondary" data-back>Back</button>' } else { "" })
    <button type="button" class="nav-btn" data-next>Continue</button>
  </div>
  <div class="error"></div>
</section>
"@
  }

  if ($Step.type -eq "contact") {
    return @"
<section class="step" data-step="$Index">
  <h2>$($Step.title)</h2>
  <p class="step-help">$($Step.help)</p>
  <div class="field-grid two-col">
    <div>
      <label class="field-label" for="fullName">Full Name</label>
      <input id="fullName" name="Full Name" type="text" placeholder="Full Name" />
    </div>
    <div>
      <label class="field-label" for="phone">Phone Number</label>
      <input id="phone" name="Phone Number" type="tel" placeholder="Phone Number" />
    </div>
    <div>
      <label class="field-label" for="email">Email Address</label>
      <input id="email" name="Email Address" type="email" placeholder="Email Address" />
    </div>
    <div>
      <label class="field-label" for="contactMethod">Preferred contact method</label>
      <select id="contactMethod" name="Preferred contact method">
        <option value="">Choose contact method</option>
        <option>Phone call</option>
        <option>Text message</option>
        <option>Email</option>
      </select>
    </div>
  </div>
  <div class="trust-note">Choose the contact method you prefer. The request is intended for relevant local professionals only, and you stay in control of follow-up.</div>
  <div class="nav-row">
    $(if ($Index -gt 0) { '<button type="button" class="nav-btn secondary" data-back>Back</button>' } else { "" })
    <button type="submit" class="submit-btn">Get My Free Quotes</button>
  </div>
  <div class="microcopy">Free &bull; No obligation &bull; No broad spam blast &bull; Built to reduce repetitive follow-up questions</div>
  <div class="error"></div>
</section>
"@
  }

  if ($Step.type -eq "contact-location") {
    return @"
<section class="step" data-step="$Index">
  <h2>$($Step.title)</h2>
  <p class="step-help">$($Step.help)</p>
  <div class="field-grid two-col">
    <div>
      <label class="field-label" for="city">City</label>
      <input id="city" name="City" type="text" placeholder="City" />
    </div>
    <div>
      <label class="field-label" for="zip">ZIP Code</label>
      <input id="zip" name="ZIP Code" type="text" inputmode="numeric" placeholder="ZIP Code" />
    </div>
    <div>
      <label class="field-label" for="fullName">Full Name</label>
      <input id="fullName" name="Full Name" type="text" placeholder="Full Name" />
    </div>
    <div>
      <label class="field-label" for="phone">Phone Number</label>
      <input id="phone" name="Phone Number" type="tel" placeholder="Phone Number" />
    </div>
    <div>
      <label class="field-label" for="email">Email Address</label>
      <input id="email" name="Email Address" type="email" placeholder="Email Address" />
    </div>
    <div>
      <label class="field-label" for="contactMethod">Preferred contact method</label>
      <select id="contactMethod" name="Preferred contact method">
        <option value="">Choose contact method</option>
        <option>Phone call</option>
        <option>Text message</option>
        <option>Email</option>
      </select>
    </div>
  </div>
  <div class="trust-note">You stay in control of how matched professionals contact you. The request is intended for relevant local professionals and is not meant to be broadly blasted out.</div>
  <div class="nav-row">
    $(if ($Index -gt 0) { '<button type="button" class="nav-btn secondary" data-back>Back</button>' } else { "" })
    <button type="submit" class="submit-btn">Get My Free Quotes</button>
  </div>
  <div class="microcopy">Free &bull; No obligation &bull; No broad spam blast &bull; Designed to improve estimate quality without unnecessary back-and-forth</div>
  <div class="error"></div>
</section>
"@
  }

  return ""
}

function Render-FlowPageBody {
  param(
    [string]$FlowKey,
    [string]$BreadcrumbLabel,
    [string]$BackHref
  )

  $flow = Get-DataValue $flows $FlowKey
  $flowCanonical = switch ($FlowKey) {
    "kitchen" { "$($site.baseUrl)/kitchen-remodeling/request/" }
    "cleaning" { "$($site.baseUrl)/house-cleaning/request/" }
    default { "$($site.baseUrl)/request/" }
  }
  $landingPageName = switch ($FlowKey) {
    "kitchen" { "quote-flow-kitchen.html" }
    "cleaning" { "quote-flow-house-cleaning.html" }
    default { "quote-flow-standard.html" }
  }
  $hiddenServiceType = if ($flow.steps[0].field -eq "Service Type") { "" } else { "<input type=""hidden"" name=""Service Type"" value=""$($flow.serviceLabel)"" />" }
  $breadcrumbs = @(
    @{ label = "Home"; href = "index.html"; url = "$($site.baseUrl)/" },
    @{ label = "Services"; href = "services.html"; url = "$($site.baseUrl)/services/" },
    @{ label = $BreadcrumbLabel; href = $BackHref; url = if ($BackHref -eq "service-kitchen-remodeling.html") { "$($site.baseUrl)/kitchen-remodeling/" } elseif ($BackHref -eq "services.html") { "$($site.baseUrl)/services/" } else { "$($site.baseUrl)/request/" } },
    @{ label = "Request"; href = $null; url = $flowCanonical }
  )

  $stepsMarkup = for ($i = 0; $i -lt $flow.steps.Count; $i++) {
    Render-FlowStep -Flow $flow -Step $flow.steps[$i] -Index $i
  }

  return @"
$(Render-FlowHeader)
<main class="section quote-page">
  <div class="container quote-shell" data-track="flow-page" data-service="$(To-Slug $flow.serviceLabel)">
    <div class="quote-breadcrumb-wrap">
      $(Render-BreadcrumbsHtml $breadcrumbs)
      <span class="quote-flow-meta" data-flow-page-title>$($flow.pageTitle)</span>
      <span class="quote-flow-meta" data-flow-intro>$($flow.intro)</span>
    </div>
    <div class="quote-layout">
      <aside class="quote-sidebar">
        <div class="panel quote-sidebar-panel">
          <h2 data-flow-service-label>$($flow.serviceLabel)</h2>
          <div class="progress-wrap">
            <div class="progress-top">
              <span id="stepLabel">Step 1 of $($flow.steps.Count)</span>
            </div>
            <div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
          </div>
          <div id="stepMiniTitle" class="quote-step-title">$($flow.steps[0].title)</div>
                <div class="quote-trust-line">&#10003; Free to use &middot; &#10003; No obligation &middot; &#10003; Local professionals &middot; &#10003; No spam blast</div>
        </div>
      </aside>
      <div class="panel quote-form-panel">
        <form data-quote-flow-form data-track="quote-flow-form" data-service="$(To-Slug $flow.serviceLabel)" action="/api/lead" method="POST" enctype="multipart/form-data">
          <div style="position:absolute;left:-5000px;top:auto;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
            <label for="companyTrap">Leave this field empty</label>
            <input id="companyTrap" type="text" name="company" tabindex="-1" autocomplete="off" />
          </div>
          $hiddenServiceType
          <input type="hidden" name="Landing Page" value="$landingPageName" />
          <input type="hidden" name="Landing Page URL" value="$flowCanonical" />
          $($stepsMarkup -join "")
        </form>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@
}

$robots = "noindex,nofollow"
$organizationSchema = New-OrganizationSchema
$websiteSchema = New-WebsiteSchema

$homeFaqs = Get-DataValue $faqs "home"
$homeTrust = Get-DataValue $trustBlocks "home"

$serviceStarterItems = $activeServices | ForEach-Object {
  $service = $_
  [pscustomobject]@{
    key = $service.key
    label = $service.label
    href = Resolve-ServiceCtaHref $service.key
    summary = $service.shortText
    cta = if ($service.requestFlow -eq "premium") { "Premium request" } else { "Quick request" }
    keywords = @(Get-ServiceKeywords $service)
  }
}
$serviceStarterJson = ($serviceStarterItems | ConvertTo-Json -Depth 10 -Compress)
$serviceStarterCatalogMarkup = ($serviceStarterItems | ForEach-Object {
  "<a class=""service-starter-option"" href=""$($_.href)"" data-service-option data-track=""service_selected"" data-cta=""service-search-option"" data-service=""$($_.key)"" data-keywords=""$(Html-Escape (($_.keywords -join " | ")))""><strong>$(Html-Escape $_.label)</strong><span>$(Html-Escape $_.cta) &middot; $(Html-Escape $_.summary)</span></a>"
}) -join ""

$mostRequestedCards = @(
  $serviceMap["kitchen-remodeling"],
  $serviceMap["house-cleaning"],
  $serviceMap["roofing"],
  $serviceMap["plumbing"],
  $serviceMap["hvac"],
  $serviceMap["handyman"]
) | ForEach-Object {
  @{
    title = $_.label
    text = $_.shortText
    href = Resolve-ServiceCtaHref $_.key
    image = $_.image
    alt = "$($_.label) service image"
    cta = if ($_.requestFlow -eq "premium") { "Start request" } else { "Quick request" }
    disabled = $_.status -ne "active"
    status = $null
    serviceKey = $_.key
    track = "service-card"
    ctaTrack = if ($_.requestFlow -eq "premium") { "premium-service-card" } else { "standard-service-card" }
  }
}

$homeCategoryCards = @(
  "remodeling-construction",
  "cleaning-services",
  "roofing-exterior",
  "plumbing",
  "electrical",
  "hvac",
  "outdoor-landscaping",
  "general-home-services"
) | ForEach-Object {
  $category = $categoryMap[$_]
  @{
    title = $category.label
    text = $category.description
    href = Resolve-CategoryHref $category.key
    ctaTrack = if ($category.hasPage) { "active-category-card" } else { "services-hub-category-card" }
  }
}

$servicesHubCards = @(
  $serviceMap["kitchen-remodeling"],
  $serviceMap["house-cleaning"],
  $serviceMap["roofing"],
  $serviceMap["plumbing"],
  $serviceMap["hvac"],
  $serviceMap["handyman"]
) | ForEach-Object {
  @{
    title = $_.label
    text = $_.shortText
    href = Resolve-ServiceHref $_.key
    image = $_.image
    alt = "$($_.label) service image"
    cta = if ($_.requestFlow -eq "premium") { "Start request" } else { "Quick request" }
    disabled = $false
    status = $_.status
    serviceKey = $_.key
    track = "service_selected"
    ctaTrack = if ($_.requestFlow -eq "premium") { "premium-service-card" } else { "standard-service-card" }
  }
}

$homeBody = @"
$(Render-HomeHeader)
<main>
  <section class="hero">
    <div class="container">
      <div class="panel hero-shell">
        <div>
          <h1>$($site.heroTitle)</h1>
          <p class="lead">$($site.heroText)</p>
          <div class="service-starter" data-service-starter data-track="service-search-starter">
            <label class="service-starter-label" for="serviceStarterInput">What service do you need?</label>
            <div class="service-starter-input-wrap">
              <input id="serviceStarterInput" class="service-starter-input" type="text" autocomplete="off" placeholder="Try kitchen remodeling, house cleaning, roofing, or plumbing" data-service-starter-input data-service-search-input data-track="service-search-input" />
            </div>
            <div class="service-starter-results" data-service-starter-results data-service-search-results></div>
            <div class="service-starter-catalog" hidden aria-hidden="true">$serviceStarterCatalogMarkup</div>
            <p class="service-starter-help">Popular searches: Kitchen Remodeling, House Cleaning, Roofing, Plumbing</p>
          </div>
          <div class="hero-actions">
            <a class="btn btn-primary" href="services.html" data-track="hero_start_request" data-cta="start-request">$($site.requestCta)</a>
            <a class="btn btn-secondary" href="services.html" data-track="browse_services" data-cta="browse-services">$($site.secondaryCta)</a>
          </div>
          <p class="trust-inline">Free to use &middot; No obligation &middot; Local professionals &middot; No spam</p>
        </div>
        <div class="hero-media">
          <img src="assets/images/hero-home-improvement.jpg" alt="Homeowner reviewing a home improvement project with a local professional" />
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="services">
    <div class="container">
      <div class="panel">
        <div class="section-head">
          <div class="eyebrow">Most requested services</div>
          <h2>Start with a popular service</h2>
          <p>Pick the service that feels closest to your project and we'll guide you to the right next step.</p>
        </div>
        <div class="cards home-cards">$(Render-Cards $mostRequestedCards)</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="panel">
        <div class="section-head">
          <div class="eyebrow">Riverview local service pages</div>
          <h2>High-demand services for Riverview and Hillsborough County</h2>
          <p>Explore local landing pages built for homeowners comparing service options in Riverview, Brandon, Valrico, Gibsonton, Apollo Beach, and nearby Tampa Bay areas.</p>
        </div>
        <div class="cards home-cards"><a class="card" href="hvac-contractor-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="HVAC Contractor in Riverview service image">
  <h3>HVAC Contractor in Riverview, FL</h3>
  <p>Cooling, replacement, maintenance, ductwork, and indoor comfort help for Riverview-area properties.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="general-contractor-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="General Contractor in Riverview service image">
  <h3>General Contractor in Riverview, FL</h3>
  <p>Renovations, additions, larger projects, and contractor-led work that may involve multiple trades.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="foundation-repair-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="Foundation Repair in Riverview service image">
  <h3>Foundation Repair in Riverview, FL</h3>
  <p>Cracks, settling, slab concerns, moisture issues, and foundation warning signs near the home.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="drainage-contractor-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="Drainage Contractor in Riverview service image">
  <h3>Drainage Contractor in Riverview, FL</h3>
  <p>Standing water, yard grading, erosion, French drains, and drainage issues around Riverview homes.</p>
  <span class="btn btn-primary">View local page</span>
</a></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="panel">
        <div class="section-head">
          <div class="eyebrow">Categories</div>
          <h2>Find help for the project you need</h2>
          <p>Choose a service category or start with one of the most requested services.</p>
        </div>
        <div class="category-grid">$(Render-HomeCategoryGrid $homeCategoryCards)</div>
      </div>
    </div>
  </section>

  <section class="section" id="how-it-works">
    <div class="container">
      <div class="panel">
        <div class="section-head">
          <div class="eyebrow">How it works</div>
          <h2>How GetEstimateFast works</h2>
          <p>Simple steps, clear expectations, and no need to call companies one by one.</p>
        </div>
        $(Render-HomeHowItWorksCards)
        <div class="hero-actions" style="margin-top:18px;">
          <a class="btn btn-secondary" href="how-it-works.html" data-track="home-link" data-cta="learn-more-how-it-works">Learn more about how it works</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="panel">
        <div class="section-head">
          <div class="eyebrow">Trust</div>
          <h2>Why homeowners use GetEstimateFast</h2>
          <p>One request, better context, and more control over what happens next.</p>
        </div>
        <div class="trust-stack">$(Render-TrustCards $homeTrust)</div>
      </div>
    </div>
  </section>

  <section class="section" id="areas">
    <div class="container">
      <div class="panel">
        <div class="section-head">
          <div class="eyebrow">Areas we serve</div>
          <h2>Serving Riverview and the Tampa Bay area</h2>
          <p>GetEstimateFast is focused on local professionals serving Riverview, Tampa, Brandon, Valrico, Apollo Beach, and nearby communities.</p>
        </div>
        <div class="areas-list">$(Render-Pills $site.homeAreas "area-pill")</div>
        <p class="group-note" style="margin-top:16px;">Looking for Brandon-specific local pages? <a href="areas-we-serve.html#brandon-services">See Brandon service pages</a> for roofing, AC repair, plumbing, and electrical help.</p>
        <div class="hero-actions" style="margin-top:18px;">
          <a class="btn btn-secondary" href="areas-we-serve.html" data-track="home-link" data-cta="view-all-service-areas">View all service areas</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="panel">
        <div class="section-head">
          <div class="eyebrow">FAQ</div>
          <h2>Common questions before you start</h2>
          <p>Short answers to help you understand what happens after you submit a request.</p>
        </div>
        <div class="faq-list">$(Render-FaqList $homeFaqs)</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="panel cta-band">
        <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Get started</div>
        <h2>Ready to find local professionals?</h2>
        <p class="lead">Start with one request and compare options without calling companies one by one.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="services.html" data-track="hero_start_request" data-cta="footer-start-request">Start My Request</a>
          <a class="btn btn-footer-secondary" href="services.html" data-track="browse_services" data-cta="footer-browse-services">Browse Services</a>
        </div>
      </div>
    </div>
  </section>
</main>
$(Render-Footer)
<script>window.serviceStarterConfig = {"items":$serviceStarterJson};</script>
<script src="assets/platform-forms.js"></script>
"@

$homeSchemas = @(
  $organizationSchema
  $websiteSchema
  (New-FaqSchema $homeFaqs)
) -join "`n"

Write-GeneratedFile -FileName "index.html" -Content (Render-BasePage -Title $site.homeMetaTitle -MetaDescription $site.homeMetaDescription -Canonical "$($site.baseUrl)/" -Robots $robots -Schema $homeSchemas -Body $homeBody)

$servicesBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel">
      <div class="eyebrow">Services</div>
      <h1>Choose the service that best matches your project</h1>
      <p class="lead">Start with a popular service below or browse by category if you are still deciding which type of help fits best.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="quote-flow-standard.html" data-track="hero_start_request" data-cta="services-start-request">Start My Request</a>
        <a class="btn" style="background:#fff; color:var(--navy); border:1px solid var(--line);" href="service-kitchen-remodeling.html" data-track="service_selected" data-cta="services-kitchen-example" data-service="kitchen-remodeling">See a premium kitchen example</a>
      </div>
      <p class="trust-inline">Free to use &middot; No obligation &middot; Local professionals &middot; No spam blast</p>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <div class="eyebrow">Popular services</div>
        <h2>Start with a popular service</h2>
        <p>These are some of the most common ways homeowners and property owners start a request.</p>
      </div>
      <div class="cards">$(Render-Cards $servicesHubCards)</div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <div class="eyebrow">Riverview local service pages</div>
        <h2>High-priority service pages for Riverview homeowners</h2>
        <p>Browse local pages for high-demand service types in Riverview and nearby Hillsborough County communities before you start a request.</p>
      </div>
      <div class="cards"><a class="card" href="hvac-contractor-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="HVAC Contractor in Riverview service image">
  <h3>HVAC Contractor in Riverview, FL</h3>
  <p>Cooling issues, system replacement, maintenance, ductwork, and indoor comfort projects.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="general-contractor-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="General Contractor in Riverview service image">
  <h3>General Contractor in Riverview, FL</h3>
  <p>Contractor-led renovations, additions, larger project coordination, and broader construction requests.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="foundation-repair-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="Foundation Repair in Riverview service image">
  <h3>Foundation Repair in Riverview, FL</h3>
  <p>Structural warning signs, slab cracks, settling, and drainage-related foundation concerns.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="drainage-contractor-riverview-fl.html" data-track="home-link" data-cta="riverview-local-service-card">
  <img src="assets/images/standard-service.svg" alt="Drainage Contractor in Riverview service image">
  <h3>Drainage Contractor in Riverview, FL</h3>
  <p>Standing water, grading issues, erosion, stormwater movement, and yard drainage improvements.</p>
  <span class="btn btn-primary">View local page</span>
</a></div>
    </div>

    <div class="panel" style="margin-top:18px;" id="brandon-services">
      <div class="section-head">
        <div class="eyebrow">Brandon local service pages</div>
        <h2>High-priority service pages for Brandon homeowners</h2>
        <p>Explore Brandon-focused pages for roof, HVAC, plumbing, and electrical needs across Brandon, Valrico, Seffner, Bloomingdale, Lithia, Fish Hawk, and nearby Hillsborough County communities.</p>
      </div>
      <div class="cards"><a class="card" href="roofing-contractor-brandon-fl.html" data-track="home-link" data-cta="brandon-local-service-card">
  <img src="assets/images/standard-service.svg" alt="Roofing Contractor in Brandon service image">
  <h3>Roofing Contractor in Brandon, FL</h3>
  <p>Roof repair, replacement, storm damage, inspections, leaks, and shingle-related roofing needs.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="ac-repair-brandon-fl.html" data-track="home-link" data-cta="brandon-local-service-card">
  <img src="assets/images/standard-service.svg" alt="AC Repair in Brandon service image">
  <h3>AC Repair in Brandon, FL</h3>
  <p>Cooling issues, HVAC diagnostics, urgent AC trouble, maintenance, and replacement-related questions.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="plumber-brandon-fl.html" data-track="home-link" data-cta="brandon-local-service-card">
  <img src="assets/images/standard-service.svg" alt="Plumber in Brandon service image">
  <h3>Plumber in Brandon, FL</h3>
  <p>Leaks, drains, water heaters, toilet overflow concerns, and local plumbing repair requests.</p>
  <span class="btn btn-primary">View local page</span>
</a><a class="card" href="electrician-brandon-fl.html" data-track="home-link" data-cta="brandon-local-service-card">
  <img src="assets/images/standard-service.svg" alt="Electrician in Brandon service image">
  <h3>Electrician in Brandon, FL</h3>
  <p>Electrical repairs, panel upgrades, EV chargers, troubleshooting, and urgent electrical issues.</p>
  <span class="btn btn-primary">View local page</span>
</a></div>
    </div>

    <div class="service-list" style="margin-top:18px;">
      $(($categories | ForEach-Object {
        $category = $_
@"
<section class="service-group" id="category-$($category.key)">
  <div class="section-head">
    <h2>$($category.label)</h2>
    <p>$($category.description)</p>
  </div>
  <p class="group-note">$(if ($category.key -eq "remodeling-construction") { "Kitchen Remodeling includes a more detailed guided request today, while broader remodeling requests can still start with a simpler request." } else { "Choose the service that feels closest to your project and start with the option that best matches the work you need." })</p>
  <div class="service-links">
    $(($category.servicesDisplay | ForEach-Object {
      Render-ServiceHubChip $_
    }) -join "")$(if ($category.key -eq "remodeling-construction") { '<a class="service-link is-active" href="general-contractor-riverview-fl.html">General Contractor in Riverview, FL</a>' } elseif ($category.key -eq "roofing-exterior") { '<a class="service-link is-active" href="foundation-repair-riverview-fl.html">Foundation Repair in Riverview, FL</a><a class="service-link is-active" href="roofing-contractor-brandon-fl.html">Roofing Contractor in Brandon, FL</a>' } elseif ($category.key -eq "plumbing") { '<a class="service-link is-active" href="plumber-brandon-fl.html">Plumber in Brandon, FL</a>' } elseif ($category.key -eq "electrical") { '<a class="service-link is-active" href="electrician-brandon-fl.html">Electrician in Brandon, FL</a>' } elseif ($category.key -eq "hvac") { '<a class="service-link is-active" href="hvac-contractor-riverview-fl.html">HVAC Contractor in Riverview, FL</a><a class="service-link is-active" href="ac-repair-brandon-fl.html">AC Repair in Brandon, FL</a>' } elseif ($category.key -eq "outdoor-landscaping") { '<a class="service-link is-active" href="drainage-contractor-riverview-fl.html">Drainage Contractor in Riverview, FL</a>' } else { "" })
  </div>
</section>
"@
      }) -join "")
    </div>
  </div>
</main>
$(Render-Footer)
"@

$servicesSchemas = @(
  $organizationSchema
  (New-CollectionPageSchema -Name "Services | $($site.name)" -Description "Browse service categories and quote request options for homeowners and businesses across the Tampa Bay area." -Canonical "$($site.baseUrl)/services.html")
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services.html" }
  ))
) -join "`n"

Write-GeneratedFile -FileName "services.html" -Content (Render-BasePage -Title "Services | GetEstimateFast" -MetaDescription "Browse home and property services across Tampa Bay and move into the right quote request flow for your project." -Canonical "$($site.baseUrl)/services.html" -Robots $robots -Schema $servicesSchemas -Body $servicesBody)

$category = $categoryMap["remodeling-construction"]
$categoryFaqs = Get-DataValue $faqs "category-remodeling-construction"
$categoryActiveCards = $category.services | Where-Object { $serviceMap[$_].status -eq "active" } | ForEach-Object {
  $service = $serviceMap[$_]
  @{
    title = $service.label
    text = $service.shortText
    href = Resolve-ServiceHref $service.key
    image = $service.image
    alt = "$($service.label) service image"
    cta = if ($service.requestFlow -eq "premium") { "Start request" } else { "Quick request" }
    disabled = $false
    status = $service.status
    serviceKey = $service.key
    track = "category-service-card"
    ctaTrack = if ($service.requestFlow -eq "premium") { "premium-category-service-card" } else { "standard-category-service-card" }
  }
}
$categoryPlannedLabels = $category.services | Where-Object { $serviceMap[$_].status -ne "active" } | ForEach-Object { $serviceMap[$_].label }
$categoryPopularCities = $category.popularCities | ForEach-Object { "<span class=""service-link"">$($cityMap[$_].label)</span>" }
$categoryBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "Services"; href = "services.html" },
          @{ label = $category.label; href = $null }
        ))
        <div class="eyebrow">Remodeling &amp; Construction</div>
        <h1>$($category.heroHeading)</h1>
        <p class="lead">$($category.heroText)</p>
        <div class="trust-row">$(Render-Pills @("Free to use", "No obligation", "Compare local professionals", "You stay in control") "trust-pill")</div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="service-kitchen-remodeling.html" data-track="category-cta" data-cta="view-kitchen-service" data-service="kitchen-remodeling">View Kitchen Remodeling</a>
          <a class="btn" style="background:#fff; color:var(--navy); border:1px solid var(--line);" href="services.html" data-track="category-cta" data-cta="back-to-services">Back to Services</a>
        </div>
      </div>
      <div class="detail-card">
        <h3>Areas we currently serve</h3>
        <p>Many requests in this category come from Riverview and nearby Tampa Bay communities.</p>
        <div class="service-links" style="margin-top:12px;">$($categoryPopularCities -join "")</div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Why start from the right remodeling category?</h2>
      </div>
      <div class="copy">$((($category.introParagraphs | ForEach-Object { "<p>$(Html-Escape $_)</p>" }) -join ""))</div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Start with the remodeling option that feels closest to your project</h2>
        <p>These request options are available now and help keep the first conversation focused.</p>
      </div>
      <div class="cards">$(Render-Cards $categoryActiveCards)</div>
      $(if ($categoryPlannedLabels.Count -gt 0) { "<p class=""group-note"" style=""margin-top:16px;"">Also commonly requested: " + (($categoryPlannedLabels | ForEach-Object { Html-Escape $_ }) -join ", ") + ".</p>" } else { "" })
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>How to choose the best starting point</h2>
      </div>
      <div class="callout-row">
        $(for ($i = 0; $i -lt $category.whyItWorks.Count; $i++) {
@"
<div class="callout-card">
  <h3>Tip $($i + 1)</h3>
  <p>$(Html-Escape $category.whyItWorks[$i])</p>
</div>
"@
        })
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Frequently asked questions about remodeling and construction requests</h2>
      </div>
      <div class="faq-list">$(Render-FaqList $categoryFaqs)</div>
      <div class="hero-actions" style="margin-top:18px;">
        <a class="btn btn-primary" href="service-kitchen-remodeling.html" data-track="category-cta" data-cta="start-with-kitchen" data-service="kitchen-remodeling">Start with Kitchen Remodeling</a>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

$categorySchemas = @(
  $organizationSchema
  (New-CollectionPageSchema -Name $category.label -Description $category.metaDescription -Canonical "$($site.baseUrl)/category-remodeling-construction.html")
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services.html" },
    @{ name = $category.label; url = "$($site.baseUrl)/category-remodeling-construction.html" }
  ))
  (New-FaqSchema $categoryFaqs)
) -join "`n"

Write-GeneratedFile -FileName "category-remodeling-construction.html" -Content (Render-BasePage -Title $category.metaTitle -MetaDescription $category.metaDescription -Canonical "$($site.baseUrl)/category-remodeling-construction.html" -Robots $robots -Schema $categorySchemas -Body $categoryBody)

$service = $serviceMap["kitchen-remodeling"]
$serviceFaqs = Get-DataValue $faqs "service-kitchen-remodeling"
$serviceTrust = Get-DataValue $trustBlocks "service-kitchen-remodeling"
$serviceBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "Services"; href = "services.html" },
          @{ label = $category.label; href = "category-remodeling-construction.html" },
          @{ label = $service.label; href = $null }
        ))
        <div class="eyebrow">Kitchen Remodeling</div>
        <h1>$($service.heroHeading)</h1>
        <p class="lead">$($service.heroText)</p>
        <div class="trust-row">$(Render-Pills @("Free to use", "No obligation", "Compare local professionals", "You stay in control") "trust-pill")</div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="quote-flow-kitchen.html" data-track="service-cta" data-cta="start-kitchen-request" data-service="kitchen-remodeling">Start My Kitchen Request</a>
          <a class="btn" style="background:#fff; color:var(--navy); border:1px solid var(--line);" href="location-kitchen-remodeling-riverview-fl.html" data-track="service-cta" data-cta="view-riverview-local-page" data-service="kitchen-remodeling" data-city="riverview-fl">See the Riverview page</a>
        </div>
      </div>
      <div class="hero-media">
        <img src="$($service.image)" alt="$($service.label) project image" />
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Why homeowners use this request flow for kitchen projects</h2>
      </div>
      <div class="trust-stack">$(Render-TrustCards $serviceTrust)</div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>$($service.includedHeading)</h2>
      </div>
      <div class="grid-2">
        <div class="detail-card">
          <h3>Common project types</h3>
          <ul class="spec-list">$(Render-ListItems $service.projectTypes)</ul>
        </div>
        <div class="detail-card">
          <h3>What professionals usually need to know</h3>
          <ul class="spec-list">
            <li>Project type and planning stage</li>
            <li>General kitchen size or layout</li>
            <li>Scope details such as cabinets, countertops, plumbing, flooring, or lighting</li>
            <li>Timeline and whether materials are already selected</li>
            <li>Photos when available</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Pricing guidance and timeline expectations</h2>
      </div>
      <div class="grid-2">
        <div class="copy"><p>$($service.pricingGuidance)</p></div>
        <div class="copy"><p>$($service.timelineGuidance)</p></div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>What happens after you submit</h2>
      </div>
      $(Render-HowItWorksCards)
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Kitchen remodeling quote FAQs</h2>
      </div>
      <div class="faq-list">$(Render-FaqList $serviceFaqs)</div>
      <div class="hero-actions" style="margin-top:18px;">
        <a class="btn btn-primary" href="quote-flow-kitchen.html" data-track="service-cta" data-cta="get-kitchen-quotes-bottom" data-service="kitchen-remodeling">Get My Kitchen Quotes</a>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Local kitchen remodeling coverage</h2>
        <p>Start with Riverview or explore nearby areas that often share contractor coverage for kitchen projects.</p>
      </div>
      <div class="service-links">
        <a class="service-link is-active" href="location-kitchen-remodeling-riverview-fl.html" data-track="service-link" data-cta="local-kitchen-page" data-service="kitchen-remodeling" data-city="riverview-fl">Kitchen Remodeling in Riverview, FL<span class="service-status service-status-active">Active now</span></a>
        $(($service.nearbyCities | ForEach-Object { "<span class=""service-link is-coming-soon"" aria-disabled=""true"" data-track=""service-link"" data-cta=""nearby-city-reference"" data-service=""kitchen-remodeling"" data-city=""$_"">$($cityMap[$_].label)<span class=""service-status"">Nearby area</span></span>" }) -join "")
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

$serviceSchemas = @(
  $organizationSchema
  (New-ServiceSchema -Service $service -Canonical "$($site.baseUrl)/service-kitchen-remodeling.html" -AreaLabel $site.region)
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services.html" },
    @{ name = $category.label; url = "$($site.baseUrl)/category-remodeling-construction.html" },
    @{ name = $service.label; url = "$($site.baseUrl)/service-kitchen-remodeling.html" }
  ))
  (New-FaqSchema $serviceFaqs)
) -join "`n"

Write-GeneratedFile -FileName "service-kitchen-remodeling.html" -Content (Render-BasePage -Title $service.metaTitle -MetaDescription $service.metaDescription -Canonical "$($site.baseUrl)/service-kitchen-remodeling.html" -Robots $robots -Schema $serviceSchemas -Body $serviceBody)

$city = $cityMap["riverview-fl"]
$locationFaqs = Get-DataValue $faqs "location-kitchen-remodeling-riverview-fl"
$nearbyCities = Get-DataValue $nearbyRelations "riverview-fl"
$locationBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "Services"; href = "services.html" },
          @{ label = $service.label; href = "service-kitchen-remodeling.html" },
          @{ label = $city.label; href = $null }
        ))
        <div class="eyebrow">Riverview, FL</div>
        <h1>Kitchen Remodeling in $($city.label)</h1>
        <p class="lead">Find local professionals for kitchen remodeling projects in $($city.city) with a guided request that helps you share the important details without making the process feel overwhelming.</p>
        <div class="trust-row">$(Render-Pills @("Local professionals near you", "No obligation", "Free to use", "You stay in control") "trust-pill")</div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="quote-flow-kitchen.html" data-track="location-cta" data-cta="start-riverview-request" data-service="kitchen-remodeling" data-city="riverview-fl">Start My Riverview Request</a>
          <a class="btn" style="background:#fff; color:var(--navy); border:1px solid var(--line);" href="service-kitchen-remodeling.html" data-track="location-cta" data-cta="back-to-service-page" data-service="kitchen-remodeling">Back to Kitchen Remodeling</a>
        </div>
      </div>
      <div class="detail-card">
        <h3>Neighborhood and nearby-area context</h3>
        <ul class="spec-list">$(Render-ListItems $city.neighborhoods)</ul>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Why this page feels local</h2>
      </div>
      <div class="copy">$((($city.localContext | ForEach-Object { "<p>$(Html-Escape $_)</p>" }) -join ""))</div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Nearby areas that often overlap with Riverview coverage</h2>
        <p>For larger remodeling projects, homeowners in Riverview often compare availability across nearby communities where contractor coverage naturally overlaps.</p>
      </div>
      <div class="service-links">
        $(($nearbyCities | ForEach-Object { "<span class=""service-link is-coming-soon"" aria-disabled=""true"" data-track=""location-link"" data-cta=""nearby-city-reference"" data-service=""kitchen-remodeling"" data-city=""$_"">$($cityMap[$_].label)<span class=""service-status"">Coverage reference</span></span>" }) -join "")
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Common kitchen remodeling requests in Riverview</h2>
      </div>
      <div class="grid-3">
        <div class="detail-card"><h3>Layout refreshes</h3><p>Projects that keep the existing footprint but update cabinets, countertops, backsplash, lighting, or flooring.</p></div>
        <div class="detail-card"><h3>Function upgrades</h3><p>Sink and faucet replacements, better storage, appliance updates, or improved kitchen lighting.</p></div>
        <div class="detail-card"><h3>Full remodel planning</h3><p>Larger projects involving layout changes, plumbing and electrical updates, and broader material decisions.</p></div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Kitchen remodeling FAQs for Riverview</h2>
      </div>
      <div class="faq-list">$(Render-FaqList $locationFaqs)</div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Nearby local areas</h2>
        <p>These nearby communities often overlap with Riverview coverage for kitchen remodeling projects.</p>
      </div>
      <div class="service-links">
        $(($nearbyCities | ForEach-Object { "<span class=""service-link is-coming-soon"" aria-disabled=""true"" data-track=""location-link"" data-cta=""nearby-city-reference"" data-service=""kitchen-remodeling"" data-city=""$_"">$($cityMap[$_].label)<span class=""service-status"">Nearby area</span></span>" }) -join "")
      </div>
      <div class="hero-actions" style="margin-top:18px;">
        <a class="btn btn-primary" href="quote-flow-kitchen.html" data-track="location-cta" data-cta="get-kitchen-quotes-local-bottom" data-service="kitchen-remodeling" data-city="riverview-fl">Get My Kitchen Quotes</a>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

$locationSchemas = @(
  $organizationSchema
  (New-ServiceSchema -Service $service -Canonical "$($site.baseUrl)/location-kitchen-remodeling-riverview-fl.html" -AreaLabel $city.label)
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services.html" },
    @{ name = $service.label; url = "$($site.baseUrl)/service-kitchen-remodeling.html" },
    @{ name = $city.label; url = "$($site.baseUrl)/location-kitchen-remodeling-riverview-fl.html" }
  ))
  (New-FaqSchema $locationFaqs)
) -join "`n"

Write-GeneratedFile -FileName "location-kitchen-remodeling-riverview-fl.html" -Content (Render-BasePage -Title "Kitchen Remodeling in $($city.label) | $($site.name)" -MetaDescription "Request kitchen remodeling quotes in $($city.label) and compare local professionals for cabinets, countertops, lighting, backsplashes, flooring, and more." -Canonical "$($site.baseUrl)/location-kitchen-remodeling-riverview-fl.html" -Robots $robots -Schema $locationSchemas -Body $locationBody)

$areasPageEntries = @(
    @{ key = "riverview-fl"; label = "Riverview, FL"; text = "Homeowners in Riverview can request estimates for remodeling, flooring, painting, drywall, plumbing, roofing, HVAC, drainage, and other local home improvement projects." },
  @{ label = "Tampa, FL"; text = "Property owners in Tampa often use GetEstimateFast to compare local estimates for renovations, repairs, cleaning, and contractor-led upgrades." },
    @{ key = "brandon-fl"; label = "Brandon, FL"; text = "Brandon homeowners can request local estimates for kitchen updates, bathroom projects, flooring, painting, roofing, HVAC, plumbing, electrical work, and general home services." },
  @{ label = "Valrico, FL"; text = "Valrico projects often include remodeling, drywall, painting, plumbing, and other home improvement requests that benefit from clearer project details." },
  @{ label = "Apollo Beach, FL"; text = "Apollo Beach residents can request estimates for home upgrades, exterior work, cleaning, and maintenance projects from local professionals." },
  @{ label = "Ruskin, FL"; text = "Ruskin homeowners can use GetEstimateFast to start remodeling, painting, flooring, plumbing, and general property improvement requests." },
  @{ label = "Wimauma, FL"; text = "Wimauma service requests often focus on remodeling, flooring, drywall, outdoor work, and broader home improvement projects." },
  @{ label = "Gibsonton, FL"; text = "Gibsonton homeowners can request local estimates for repairs, renovations, painting, flooring, and other projects that need trusted pros nearby." },
  @{ label = "Seffner, FL"; text = "Seffner projects often include interior updates, drywall work, painting, plumbing, and contractor-led remodeling requests." },
  @{ label = "Plant City, FL"; text = "Plant City homeowners can request estimates for remodeling, flooring, painting, cleaning, and general home service projects." },
  @{ label = "Wesley Chapel, FL"; text = "Wesley Chapel requests often involve kitchen upgrades, bathroom updates, flooring installations, and other home improvement work." },
  @{ label = "Clearwater, FL"; text = "Clearwater property owners can compare local estimates for remodeling, cleaning, painting, drywall, and additional improvement services." },
  @{ label = "St. Petersburg, FL"; text = "St. Petersburg homeowners can request local estimates for kitchen projects, painting, flooring, plumbing, and property updates." },
  @{ label = "Lakeland, FL"; text = "Lakeland requests often include remodeling, drywall, painting, cleaning, and broader residential improvement projects." },
  @{ label = "Bradenton, FL"; text = "Bradenton homeowners can use GetEstimateFast to compare local estimates for remodeling, flooring, painting, and general home services." }
)

foreach ($localPage in $localSeoPages) {
  $localService = $serviceMap[$localPage.serviceKey]
  $localCity = $cityMap[$localPage.cityKey]
  $relatedLocalPages = @($localSeoPages | Where-Object { $_.cityKey -eq $localPage.cityKey -and $_.fileName -ne $localPage.fileName })
  $relatedServiceLinksMarkup = ($relatedLocalPages | ForEach-Object {
    "<a class=""service-link is-active"" href=""$($_.fileName)"">$(Html-Escape (Get-LocalSeoLinkLabel $_))</a>"
  }) -join ""
  $nearbyAreaMarkup = ($localPage.nearbyAreas | ForEach-Object { "<span class=""service-link is-coming-soon"" aria-disabled=""true"">$(Html-Escape $_)<span class=""service-status"">Nearby area</span></span>" }) -join ""
  $localFaqs = @($localPage.faqs)

  switch ($localPage.serviceKey) {
    "bathroom-remodeling" {
      $secondaryHref = "category-remodeling-construction.html"
      $secondaryLabel = "Browse Remodeling Services"
      $projectExamplesHeading = "What bathroom remodeling projects can be included"
      $schemaServiceName = "Bathroom Remodeling"
    }
    "flooring" {
      $secondaryHref = "flooring-installation.html"
      $secondaryLabel = "View Flooring Installation"
      $projectExamplesHeading = "What flooring projects can be included"
      $schemaServiceName = "Flooring Installation"
    }
    "painting" {
      $secondaryHref = "painting.html"
      $secondaryLabel = "View Painting Services"
      $projectExamplesHeading = "What painting projects can be included"
      $schemaServiceName = "Painting Services"
    }
    "drywall" {
      $secondaryHref = "drywall.html"
      $secondaryLabel = "View Drywall Services"
      $projectExamplesHeading = "What drywall projects can be included"
      $schemaServiceName = "Drywall Repair"
    }
    default {
      $secondaryHref = "services.html"
      $secondaryLabel = "Browse Services"
      $projectExamplesHeading = "What projects can be included"
      $schemaServiceName = $localService.label
    }
  }

  $localBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "Areas We Serve"; href = "areas-we-serve.html" },
          @{ label = $localPage.h1; href = $null }
        ))
        <div class="eyebrow">$(Html-Escape $localService.label) &bull; $(Html-Escape $localCity.label)</div>
        <h1>$(Html-Escape $localPage.h1)</h1>
        <p class="lead">$(Html-Escape $localPage.lead)</p>
        <div class="trust-row">$(Render-Pills @("Free to use", "No obligation", "Local professionals", "You stay in control") "trust-pill")</div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="$($localPage.ctaHref)" data-track="local-page-cta" data-cta="primary-local-request" data-service="$($localPage.serviceKey)" data-city="$($localPage.cityKey)">$(Html-Escape $localPage.ctaLabel)</a>
          <a class="btn" style="background:#fff; color:var(--navy); border:1px solid var(--line);" href="$secondaryHref" data-track="local-page-cta" data-cta="secondary-local-link" data-service="$($localPage.serviceKey)" data-city="$($localPage.cityKey)">$secondaryLabel</a>
        </div>
      </div>
      <div class="detail-card">
        <h3>About this service in $(Html-Escape $localCity.city)</h3>
        <p>GetEstimateFast helps homeowners and businesses connect with local professionals serving $(Html-Escape $localCity.city). We do not perform the services directly.</p>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>About this service in $(Html-Escape $localCity.city)</h2>
      </div>
      <div class="copy">$((($localPage.aboutParagraphs | ForEach-Object { "<p>$(Html-Escape $_)</p>" }) -join ""))</div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>$projectExamplesHeading</h2>
      </div>
      <div class="grid-2">
        <div class="detail-card">
          <h3>Common project examples</h3>
          <ul class="spec-list">$(Render-ListItems $localPage.includedItems)</ul>
        </div>
        <div class="detail-card">
          <h3>Helpful details to include</h3>
          <ul class="spec-list">
            <li>What part of the project needs the most attention</li>
            <li>Whether the work is a repair, replacement, or broader update</li>
            <li>The general timing you have in mind</li>
            <li>Photos when available to help local professionals understand the scope</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>How GetEstimateFast works</h2>
      </div>
      $(Render-HowItWorksCards)
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Local service coverage and nearby areas</h2>
      </div>
      <div class="copy">$((($localPage.coverageParagraphs | ForEach-Object { "<p>$(Html-Escape $_)</p>" }) -join ""))</div>
      <div class="service-links" style="margin-top:14px;">$nearbyAreaMarkup</div>
      <div class="hero-actions" style="margin-top:18px;">
        <a class="btn btn-secondary" href="areas-we-serve.html" data-track="local-page-link" data-cta="view-all-service-areas" data-city="$($localPage.cityKey)">View all service areas</a>
        <a class="btn btn-secondary" href="how-it-works.html" data-track="local-page-link" data-cta="learn-how-it-works" data-service="$($localPage.serviceKey)">Learn how it works</a>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>FAQ</h2>
      </div>
      <div class="faq-list">$(Render-FaqList $localFaqs)</div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Related local services</h2>
        <p>Explore related services people often compare in $(Html-Escape $localCity.city).</p>
      </div>
      <div class="service-links">$relatedServiceLinksMarkup</div>
    </div>

    <div class="panel cta-band" style="margin-top:18px;">
      <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Get started</div>
      <h2>Ready to compare local estimates in $(Html-Escape $localCity.city)?</h2>
      <p class="lead">Start one request, share the project details once, and compare your options with no obligation.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="$($localPage.ctaHref)" data-track="local-page-cta" data-cta="bottom-local-request" data-service="$($localPage.serviceKey)" data-city="$($localPage.cityKey)">$(Html-Escape $localPage.ctaLabel)</a>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

  $localSchemas = @(
    $organizationSchema
    (New-ServiceSchema -Service $localService -Canonical "$($site.baseUrl)/$($localPage.fileName)" -AreaLabel $localCity.label -Description $localPage.metaDescription -NameOverride $schemaServiceName)
    (New-BreadcrumbSchema @(
      @{ name = "Home"; url = "$($site.baseUrl)/" },
      @{ name = "Areas We Serve"; url = "$($site.baseUrl)/areas-we-serve.html" },
      @{ name = $localPage.h1; url = "$($site.baseUrl)/$($localPage.fileName)" }
    ))
    (New-FaqSchema $localFaqs)
  ) -join "`n"

  Write-GeneratedFile -FileName $localPage.fileName -Content (Render-BasePage -Title $localPage.title -MetaDescription $localPage.metaDescription -Canonical "$($site.baseUrl)/$($localPage.fileName)" -Robots $robots -Schema $localSchemas -Body $localBody)
}

$areasPageBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "Areas We Serve"; href = $null }
        ))
        <div class="eyebrow">Local coverage</div>
        <h1>Areas We Serve Across Tampa Bay</h1>
        <p class="lead">GetEstimateFast helps homeowners and businesses connect with local professionals for remodeling, flooring, painting, drywall, plumbing, roofing, cleaning, and other home improvement services.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="services.html" data-track="areas-page-cta" data-cta="start-request-from-areas">Start My Request</a>
        </div>
      </div>
      <div class="detail-card">
        <h3>Focused on local coverage</h3>
        <p>We focus on Tampa Bay communities where homeowners and businesses often need remodeling, repair, cleaning, and general property service estimates.</p>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Primary service areas</h2>
      </div>
      <div class="grid-3">
        $(($areasPageEntries | ForEach-Object {
          $areaEntry = $_
          $cityLocalPages = @()
          if ($areaEntry.ContainsKey("key")) {
            $entryCityKey = $areaEntry.key
            $cityLocalPages = @($localSeoPages | Where-Object { $_.cityKey -eq $entryCityKey })
          }
@"
<div class="detail-card">
  <h3>$(Html-Escape $areaEntry.label)</h3>
  <p>$(Html-Escape $areaEntry.text)</p>
  $(if ($cityLocalPages.Count -gt 0) {
@"
  <div class="service-links" style="margin-top:12px;">
    $(($cityLocalPages | ForEach-Object { "<a class=""service-link is-active"" href=""$($_.fileName)"">$(Html-Escape (Get-LocalSeoLinkLabel $_))</a>" }) -join "")
  </div>
"@
  } else { "" })
</div>
"@
        }) -join "")
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Recommended Riverview service pages</h2>
        <p>These local pages highlight common project types Riverview homeowners often research before requesting estimates.</p>
      </div>
      <div class="service-links">
        <a class="service-link is-active" href="hvac-contractor-riverview-fl.html">HVAC Contractor in Riverview, FL</a>
        <a class="service-link is-active" href="general-contractor-riverview-fl.html">General Contractor in Riverview, FL</a>
        <a class="service-link is-active" href="foundation-repair-riverview-fl.html">Foundation Repair in Riverview, FL</a>
        <a class="service-link is-active" href="drainage-contractor-riverview-fl.html">Drainage Contractor in Riverview, FL</a>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;" id="brandon-services">
      <div class="section-head">
        <h2>Recommended Brandon service pages</h2>
        <p>These local pages highlight common project types Brandon homeowners often research before requesting estimates.</p>
      </div>
      <div class="service-links">
        <a class="service-link is-active" href="roofing-contractor-brandon-fl.html">Roofing Contractor in Brandon, FL</a>
        <a class="service-link is-active" href="ac-repair-brandon-fl.html">AC Repair in Brandon, FL</a>
        <a class="service-link is-active" href="plumber-brandon-fl.html">Plumber in Brandon, FL</a>
        <a class="service-link is-active" href="electrician-brandon-fl.html">Electrician in Brandon, FL</a>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Popular services by area</h2>
        <p>Explore the service pages people use most often when comparing local estimates.</p>
      </div>
      <div class="service-links">
        <a class="service-link is-active" href="services.html">All Services</a>
        <a class="service-link is-active" href="category-remodeling-construction.html">Remodeling &amp; Construction</a>
        <a class="service-link is-active" href="service-kitchen-remodeling.html">Kitchen Remodeling</a>
        <a class="service-link is-active" href="bathroom-remodeling.html">Bathroom Remodeling</a>
        <a class="service-link is-active" href="flooring-installation.html">Flooring Installation</a>
        <a class="service-link is-active" href="painting.html">Painting</a>
        <a class="service-link is-active" href="drywall.html">Drywall</a>
        <a class="service-link is-active" href="plumbing.html">Plumbing</a>
      </div>
    </div>

    <div class="panel cta-band" style="margin-top:18px;">
      <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Get started</div>
      <h2>Ready to compare local estimates?</h2>
      <p class="lead">Start with one request and we will help connect you with local professionals serving your area.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="services.html" data-track="areas-page-cta" data-cta="areas-bottom-start-request">Start My Request</a>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

$areasPageSchemas = @(
  $organizationSchema
  (New-WebPageSchema -Name "Areas We Serve Across Tampa Bay" -Description "GetEstimateFast helps homeowners and businesses connect with local professionals across Riverview, Tampa, Brandon, Valrico, Apollo Beach, Ruskin, Wimauma, and nearby Tampa Bay communities." -Canonical "$($site.baseUrl)/areas-we-serve.html")
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Areas We Serve"; url = "$($site.baseUrl)/areas-we-serve.html" }
  ))
) -join "`n"

Write-GeneratedFile -FileName "areas-we-serve.html" -Content (Render-BasePage -Title "Areas We Serve | Home Improvement Estimates in Tampa Bay | GetEstimateFast" -MetaDescription "GetEstimateFast helps homeowners and businesses connect with local professionals across Riverview, Tampa, Brandon, Valrico, Apollo Beach, Ruskin, Wimauma, and nearby Tampa Bay communities." -Canonical "$($site.baseUrl)/areas-we-serve.html" -Robots $robots -Schema $areasPageSchemas -Body $areasPageBody)

$howItWorksFaqs = @(
  @{ question = "Is GetEstimateFast free to use?"; answer = "Yes. You can submit a request, compare options, and hear from local professionals without paying to use GetEstimateFast." },
  @{ question = "Do I have to hire someone after submitting a request?"; answer = "No. There is no obligation to hire. You can review your options and choose what works best for your project." },
  @{ question = "Who will contact me after I submit?"; answer = "If local availability exists, professionals who serve your area and match the service type may contact you using the contact method you selected." },
  @{ question = "Can I request more than one service?"; answer = "Yes. If you need help with more than one project, you can submit a separate request for each service so the details stay clear." },
  @{ question = "Why do you ask for project details?"; answer = "Project details help local professionals understand the job before they contact you, which can lead to better first responses." }
)

$howItWorksBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "How It Works"; href = $null }
        ))
        <div class="eyebrow">How it works</div>
        <h1>How GetEstimateFast Works</h1>
        <p class="lead">Describe your project once and get connected with local professionals who serve your area.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="services.html" data-track="how-page-cta" data-cta="start-request-from-how">Start My Request</a>
        </div>
      </div>
      <div class="detail-card">
        <h3>Built for clarity</h3>
        <p>GetEstimateFast helps you start with the right service, share the right details, and compare your options without unnecessary back-and-forth.</p>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>The process in six simple steps</h2>
      </div>
      <div class="callout-row">
        <div class="callout-card"><h3>1. Choose your service</h3><p>Start with the service that feels closest to your project.</p></div>
        <div class="callout-card"><h3>2. Share your project details</h3><p>Answer a few guided questions so professionals have useful context.</p></div>
        <div class="callout-card"><h3>3. Submit your request</h3><p>Send your project details once instead of calling companies one by one.</p></div>
        <div class="callout-card"><h3>4. Get contacted by local professionals</h3><p>If local availability exists, relevant professionals may reach out.</p></div>
        <div class="callout-card"><h3>5. Compare your options</h3><p>Review responses, timing, and fit before deciding what to do next.</p></div>
        <div class="callout-card"><h3>6. Choose what works best for you</h3><p>You stay in control and decide whether to move forward with any provider.</p></div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Why homeowners use GetEstimateFast</h2>
      </div>
      <div class="service-links">
        <span class="service-link">Free to use</span>
        <span class="service-link">No obligation</span>
        <span class="service-link">Local professionals</span>
        <span class="service-link">Better project details</span>
        <span class="service-link">You stay in control</span>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Important note</h2>
      </div>
      <div class="copy">
        <p>GetEstimateFast helps connect users with local professionals. We do not perform the services directly and do not guarantee pricing, availability, or response times.</p>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Frequently asked questions</h2>
      </div>
      <div class="faq-list">$(Render-FaqList $howItWorksFaqs)</div>
      <div class="hero-actions" style="margin-top:18px;">
        <a class="btn btn-primary" href="services.html" data-track="how-page-cta" data-cta="how-bottom-start-request">Start My Request</a>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

$howItWorksSchemas = @(
  $organizationSchema
  (New-WebPageSchema -Name "How GetEstimateFast Works" -Description "Learn how GetEstimateFast helps homeowners and businesses describe a project once, connect with local professionals, and compare estimates with no obligation." -Canonical "$($site.baseUrl)/how-it-works.html")
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "How It Works"; url = "$($site.baseUrl)/how-it-works.html" }
  ))
  (New-FaqSchema $howItWorksFaqs)
) -join "`n"

Write-GeneratedFile -FileName "how-it-works.html" -Content (Render-BasePage -Title "How GetEstimateFast Works | Compare Local Estimates" -MetaDescription "Learn how GetEstimateFast helps homeowners and businesses describe a project once, connect with local professionals, and compare estimates with no obligation." -Canonical "$($site.baseUrl)/how-it-works.html" -Robots $robots -Schema $howItWorksSchemas -Body $howItWorksBody)

$blogIndexCards = ($blogArticles | ForEach-Object {
@"
<article class="blog-card">
  <div class="eyebrow">$(Html-Escape $_.category)</div>
  <h3>$(Html-Escape $_.title)</h3>
  <p>$(Html-Escape $_.cardDescription)</p>
  <a class="btn btn-primary" href="$($_.fileName)" data-track="blog-card" data-cta="blog-card-open">Read article</a>
</article>
"@
}) -join ""

$blogIndexBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "Blog"; href = $null }
        ))
        <div class="eyebrow">Blog</div>
        <h1>Home Improvement Tips &amp; Cost Guides</h1>
        <p class="lead">Helpful guides for homeowners and businesses planning remodeling, flooring, painting, drywall, and other property improvement projects.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="services.html" data-track="blog-index-cta" data-cta="blog-start-request">Start My Request</a>
        </div>
      </div>
      <div class="detail-card">
        <h3>Plan with better context</h3>
        <p>Read practical guides before you start a request so local professionals have clearer project details to work from.</p>
        <div class="service-links">
          <a class="service-link is-active" href="services.html">Services</a>
          <a class="service-link is-active" href="areas-we-serve.html">Areas We Serve</a>
          <a class="service-link is-active" href="how-it-works.html">How It Works</a>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px;">
      <div class="section-head">
        <h2>Latest articles</h2>
        <p>Helpful cost guides and planning resources for common home improvement projects.</p>
      </div>
      <div class="blog-grid">$blogIndexCards</div>
    </div>

    <div class="panel cta-band" style="margin-top:18px;">
      <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Get started</div>
      <h2>Ready to start your project?</h2>
      <p class="lead">Start one request and compare local options without calling contractors one by one.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="services.html" data-track="blog-index-cta" data-cta="blog-bottom-start-request">Start My Request</a>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

$blogIndexSchemas = @(
  $organizationSchema
  (New-WebPageSchema -Name "Home Improvement Tips & Cost Guides" -Description "Helpful guides for homeowners and businesses planning remodeling, flooring, painting, drywall, and other property improvement projects." -Canonical "$($site.baseUrl)/blog.html")
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Blog"; url = "$($site.baseUrl)/blog.html" }
  ))
) -join "`n"

Write-GeneratedFile -FileName "blog.html" -Content (Render-BasePage -Title "Home Improvement Tips & Cost Guides | GetEstimateFast" -MetaDescription "Read home improvement tips, cost guides, and planning resources for remodeling, flooring, painting, drywall, and local contractor estimates." -Canonical "$($site.baseUrl)/blog.html" -Robots $robots -Schema $blogIndexSchemas -Body $blogIndexBody)

foreach ($blogArticle in $blogArticles) {
  $articleLinksMarkup = (($blogArticle.links | ForEach-Object { "<a class=""service-link is-active"" href=""$($_.href)"">$(Html-Escape $_.label)</a>" }) -join "")
  $articleBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel hero-shell">
      <div>
        $(Render-BreadcrumbsHtml @(
          @{ label = "Home"; href = "index.html" },
          @{ label = "Blog"; href = "blog.html" },
          @{ label = $blogArticle.h1; href = $null }
        ))
        <div class="eyebrow">$(Html-Escape $blogArticle.category)</div>
        <h1>$(Html-Escape $blogArticle.h1)</h1>
        <p class="lead">$(Html-Escape $blogArticle.lead)</p>
        <div class="article-meta">
          <span>By $(Html-Escape $site.name)</span>
          <span>2026 planning guide</span>
          <span>No obligation to request estimates</span>
        </div>
      </div>
      <div class="detail-card">
        <h3>Helpful next step</h3>
        <p>When you are ready, GetEstimateFast helps connect users with local professionals. We do not perform the services directly.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="$($blogArticle.ctaHref)" data-track="blog-article-cta" data-cta="blog-primary-request">$(Html-Escape $blogArticle.ctaLabel)</a>
        </div>
      </div>
    </div>

    <div class="article-wrap" style="margin-top:18px;">
      <div class="panel">
        <div class="article-prose">$(Render-ArticleSections $blogArticle.sections)</div>
      </div>

      <div class="panel">
        <div class="section-head">
          <h2>Related pages</h2>
          <p>Explore service and trust pages that can help you plan the next step.</p>
        </div>
        <div class="article-links">$articleLinksMarkup</div>
      </div>

      <div class="panel">
        <div class="section-head">
          <h2>Frequently asked questions</h2>
        </div>
        <div class="faq-list">$(Render-FaqList $blogArticle.faqs)</div>
      </div>

      <div class="panel cta-band">
        <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Get started</div>
        <h2>Need help comparing local options?</h2>
        <p class="lead">Describe the project once and compare local professionals with no obligation to hire.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="$($blogArticle.ctaHref)" data-track="blog-article-cta" data-cta="blog-bottom-request">$(Html-Escape $blogArticle.ctaLabel)</a>
          <a class="btn btn-footer-secondary" href="blog.html" data-track="blog-article-cta" data-cta="back-to-blog">Back to Blog</a>
        </div>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

  $articleSchemas = @(
    $organizationSchema
    (New-ArticleSchema -Headline $blogArticle.h1 -Description $blogArticle.metaDescription -Canonical "$($site.baseUrl)/$($blogArticle.fileName)" -Category $blogArticle.category)
    (New-BreadcrumbSchema @(
      @{ name = "Home"; url = "$($site.baseUrl)/" },
      @{ name = "Blog"; url = "$($site.baseUrl)/blog.html" },
      @{ name = $blogArticle.h1; url = "$($site.baseUrl)/$($blogArticle.fileName)" }
    ))
    (New-FaqSchema $blogArticle.faqs)
  ) -join "`n"

  Write-GeneratedFile -FileName $blogArticle.fileName -Content (Render-BasePage -Title $blogArticle.title -MetaDescription $blogArticle.metaDescription -Canonical "$($site.baseUrl)/$($blogArticle.fileName)" -Robots $robots -Schema $articleSchemas -Body $articleBody)
}

$thankYouBody = @"
$(Render-Header "services.html")
<main class="section">
  <div class="container">
    <div class="panel cta-band">
      <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Request received</div>
      <h1>Your request has been received.</h1>
      <p class="lead">We'll use your project details to help connect you with local professionals who may be a good fit.</p>
      <div class="callout-row">
        <div class="callout-card"><h3>Request received</h3><p>We received your project details and will use them to help connect you with relevant local professionals.</p></div>
        <div class="callout-card"><h3>What happens next</h3><p>If local availability exists, matched professionals may contact you using your selected contact method.</p></div>
        <div class="callout-card"><h3>You stay in control</h3><p>There is no obligation to hire. You choose which professional to respond to.</p></div>
      </div>
      <div class="hero-actions" style="margin-top:22px;">
        <a class="btn btn-primary" href="services.html" data-track="thank-you-cta" data-cta="explore-other-services">Explore other services</a>
        <a class="btn" style="background:#fff; color:var(--navy); border:1px solid rgba(255,255,255,0.5);" href="index.html" data-track="thank-you-cta" data-cta="return-home">Return home</a>
        <a class="btn" style="background:#fff; color:var(--navy); border:1px solid rgba(255,255,255,0.5);" href="services.html" data-track="thank-you-cta" data-cta="need-another-estimate">Need another estimate?</a>
      </div>
    </div>
  </div>
</main>
$(Render-Footer)
"@

$thankYouSchemas = @(
  $organizationSchema
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Thank You"; url = "$($site.baseUrl)/thank-you.html" }
  ))
) -join "`n"

Write-GeneratedFile -FileName "thank-you.html" -Content (Render-BasePage -Title "Thank You | $($site.name)" -MetaDescription "Your request has been submitted to GetEstimateFast. Learn what happens next and explore more services." -Canonical "$($site.baseUrl)/thank-you.html" -Robots $robots -Schema $thankYouSchemas -Body $thankYouBody)

$kitchenFlowBody = Render-FlowPageBody -FlowKey "kitchen" -BreadcrumbLabel "Kitchen Remodeling" -BackHref "service-kitchen-remodeling.html"
$kitchenFlowSchemas = @(
  $organizationSchema
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services/" },
    @{ name = "Kitchen Remodeling"; url = "$($site.baseUrl)/kitchen-remodeling/" },
    @{ name = "Request"; url = "$($site.baseUrl)/kitchen-remodeling/request/" }
  ))
) -join "`n"
$kitchenFlowConfigJson = $flows.kitchen | ConvertTo-Json -Depth 20 -Compress
Write-GeneratedFile -FileName "quote-flow-kitchen.html" -Content (Render-FlowPage -Title "Kitchen Remodeling Quote Request | GetEstimateFast" -MetaDescription "Start a guided kitchen remodeling quote request and share the details local professionals need for more useful estimates." -Canonical "$($site.baseUrl)/kitchen-remodeling/request/" -Robots $robots -Schema $kitchenFlowSchemas -Body $kitchenFlowBody -FlowConfigJson $kitchenFlowConfigJson)

$cleaningFlowBody = Render-FlowPageBody -FlowKey "cleaning" -BreadcrumbLabel "House Cleaning" -BackHref "services.html"
$cleaningFlowSchemas = @(
  $organizationSchema
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services/" },
    @{ name = "House Cleaning"; url = "$($site.baseUrl)/services/" },
    @{ name = "Request"; url = "$($site.baseUrl)/house-cleaning/request/" }
  ))
) -join "`n"
$cleaningFlowConfigJson = $flows.cleaning | ConvertTo-Json -Depth 20 -Compress
Write-GeneratedFile -FileName "quote-flow-house-cleaning.html" -Content (Render-FlowPage -Title "House Cleaning Quote Request | GetEstimateFast" -MetaDescription "Start a faster house cleaning quote request and compare local professionals without a long or confusing form." -Canonical "$($site.baseUrl)/house-cleaning/request/" -Robots $robots -Schema $cleaningFlowSchemas -Body $cleaningFlowBody -FlowConfigJson $cleaningFlowConfigJson)

$standardFlowBody = Render-FlowPageBody -FlowKey "standard" -BreadcrumbLabel "Service Request" -BackHref "services.html"
$standardFlowSchemas = @(
  $organizationSchema
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services/" },
    @{ name = "Request"; url = "$($site.baseUrl)/request/" }
  ))
) -join "`n"
$standardFlowConfigJson = $flows.standard | ConvertTo-Json -Depth 20 -Compress
Write-GeneratedFile -FileName "quote-flow-standard.html" -Content (Render-FlowPage -Title "Start a Service Request | GetEstimateFast" -MetaDescription "Start a guided service request and connect with relevant local professionals in the Tampa Bay area." -Canonical "$($site.baseUrl)/request/" -Robots $robots -Schema $standardFlowSchemas -Body $standardFlowBody -FlowConfigJson $standardFlowConfigJson)

Write-Host "Generated pages written to $generatedDir"
