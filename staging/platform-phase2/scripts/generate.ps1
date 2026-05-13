$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root "data"
$templateDir = Join-Path $root "templates"
$generatedDir = Join-Path $root "generated-pages"

if (!(Test-Path $generatedDir)) {
  New-Item -ItemType Directory -Path $generatedDir | Out-Null
} else {
Get-ChildItem -Path $generatedDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $generatedDir "assets\\images") -Force | Out-Null
Copy-Item -Path (Join-Path $root "assets\\platform.css") -Destination (Join-Path $generatedDir "assets\\platform.css") -Force
Copy-Item -Path (Join-Path $root "assets\\platform-forms.js") -Destination (Join-Path $generatedDir "assets\\platform-forms.js") -Force
Copy-Item -Path (Join-Path $root "assets\\images\\*") -Destination (Join-Path $generatedDir "assets\\images") -Recurse -Force
}

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

$categoryMap = @{}
$categories | ForEach-Object { $categoryMap[$_.key] = $_ }
$serviceMap = @{}
$services | ForEach-Object { $serviceMap[$_.key] = $_ }
$cityMap = @{}
$cities | ForEach-Object { $cityMap[$_.key] = $_ }

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
        <a class="nav-link" href="#how-it-works" data-track="nav-link" data-cta="how-it-works-nav">How it Works</a>
        <a class="nav-link" href="#areas" data-track="nav-link" data-cta="areas-nav">Areas</a>
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
      <div class="footer-note">$($site.name) helps homeowners and businesses connect with local professionals across $($site.region).</div>
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
    [string]$AreaLabel
  )

  $obj = [ordered]@{
    "@context" = "https://schema.org"
    "@type" = "Service"
    name = $Service.label
    serviceType = $Service.label
    provider = [pscustomobject]@{
      "@type" = "Organization"
      name = $site.name
      url = "$($site.baseUrl)/"
    }
    url = $Canonical
    description = $Service.metaDescription
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
        <form data-quote-flow-form data-track="quote-flow-form" data-service="$(To-Slug $flow.serviceLabel)" action="https://formsubmit.co/getestimatefast@gmail.com" method="POST" enctype="multipart/form-data">
          <input type="hidden" name="_next" value="https://www.getestimatefast.com/thank-you.html" />
          <input type="hidden" name="_captcha" value="false" />
          <input type="hidden" name="_template" value="table" />
          <input type="hidden" name="_subject" id="emailSubject" value="$($flow.serviceLabel) Lead" />
          <input type="hidden" name="_replyto" id="replyToEmail" />
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
    }) -join "")
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
  (New-CollectionPageSchema -Name "Services | $($site.name)" -Description "Browse service categories and quote request options for homeowners and businesses across the Tampa Bay area." -Canonical "$($site.baseUrl)/services/")
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services/" }
  ))
) -join "`n"

Write-GeneratedFile -FileName "services.html" -Content (Render-BasePage -Title "Services | GetEstimateFast" -MetaDescription "Browse home and property services across Tampa Bay and move into the right quote request flow for your project." -Canonical "$($site.baseUrl)/services/" -Robots $robots -Schema $servicesSchemas -Body $servicesBody)

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
  (New-CollectionPageSchema -Name $category.label -Description $category.metaDescription -Canonical "$($site.baseUrl)/services/$($category.slug)/")
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services/" },
    @{ name = $category.label; url = "$($site.baseUrl)/services/$($category.slug)/" }
  ))
  (New-FaqSchema $categoryFaqs)
) -join "`n"

Write-GeneratedFile -FileName "category-remodeling-construction.html" -Content (Render-BasePage -Title $category.metaTitle -MetaDescription $category.metaDescription -Canonical "$($site.baseUrl)/services/$($category.slug)/" -Robots $robots -Schema $categorySchemas -Body $categoryBody)

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
  (New-ServiceSchema -Service $service -Canonical "$($site.baseUrl)/$($service.slug)/" -AreaLabel $site.region)
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services/" },
    @{ name = $category.label; url = "$($site.baseUrl)/services/$($category.slug)/" },
    @{ name = $service.label; url = "$($site.baseUrl)/$($service.slug)/" }
  ))
  (New-FaqSchema $serviceFaqs)
) -join "`n"

Write-GeneratedFile -FileName "service-kitchen-remodeling.html" -Content (Render-BasePage -Title $service.metaTitle -MetaDescription $service.metaDescription -Canonical "$($site.baseUrl)/$($service.slug)/" -Robots $robots -Schema $serviceSchemas -Body $serviceBody)

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
  (New-ServiceSchema -Service $service -Canonical "$($site.baseUrl)/$($service.slug)/$($city.key)/" -AreaLabel $city.label)
  (New-BreadcrumbSchema @(
    @{ name = "Home"; url = "$($site.baseUrl)/" },
    @{ name = "Services"; url = "$($site.baseUrl)/services/" },
    @{ name = $service.label; url = "$($site.baseUrl)/$($service.slug)/" },
    @{ name = $city.label; url = "$($site.baseUrl)/$($service.slug)/$($city.key)/" }
  ))
  (New-FaqSchema $locationFaqs)
) -join "`n"

Write-GeneratedFile -FileName "location-kitchen-remodeling-riverview-fl.html" -Content (Render-BasePage -Title "Kitchen Remodeling in $($city.label) | $($site.name)" -MetaDescription "Request kitchen remodeling quotes in $($city.label) and compare local professionals for cabinets, countertops, lighting, backsplashes, flooring, and more." -Canonical "$($site.baseUrl)/$($service.slug)/$($city.key)/" -Robots $robots -Schema $locationSchemas -Body $locationBody)

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
