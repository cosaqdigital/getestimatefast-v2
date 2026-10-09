/* Single source of truth for the GetEstimateFast launch catalog (browser + server). */
(function (root) {
  "use strict";
  const categories = [
    {slug:"house-cleaning",name:"House Cleaning",summary:"Regular, deep, move-in/move-out and basic post-construction cleaning.",question:"What type of house cleaning do you need?",options:["Standard house cleaning","Deep cleaning","Move-in / move-out","Light post-construction cleaning","Other house cleaning"],keywords:["cleaning","maid","deep clean","home cleaning"]},
    {slug:"pressure-washing",name:"Pressure Washing",summary:"Driveways, patios, sidewalks and permitted exterior surface cleaning.",question:"What would you like pressure washed?",options:["Driveway / sidewalk","Patio / pavers","Fence / deck","House exterior","Other exterior surface"],keywords:["power washing","driveway cleaning","patio wash"]},
    {slug:"flooring",name:"Flooring",summary:"LVP, laminate, wood, tile and other flooring within the permitted scope.",question:"What flooring work do you need?",options:["LVP / vinyl","Laminate","Hardwood","Tile","Floor repair / replacement","Other flooring"],keywords:["lvp","vinyl plank","laminate","tile","wood floor"]},
    {slug:"painting",name:"Painting",summary:"Interior or exterior painting, touch-ups and wallpaper installation.",question:"What painting or wall finishing do you need?",options:["Interior painting","Exterior painting","Touch-ups","Wallpaper","Other painting"],keywords:["paint","interior","exterior","wallpaper"]},
    {slug:"cabinets-countertops",name:"Cabinets & Countertops",summary:"Assembly, installation or replacement of cabinets and countertops, excluding regulated trades.",question:"What cabinet or countertop work do you need?",options:["Cabinet assembly","Cabinet installation","Cabinet replacement","Countertop installation","Other cabinet / countertop work"],keywords:["cabinets","kitchen cabinets","countertops","vanity"]},
    {slug:"furniture-assembly",name:"Furniture Assembly",summary:"Assembly of beds, desks, shelves, wardrobes and other furniture.",question:"What furniture needs assembly?",options:["Beds / bedroom furniture","Desks / tables","Shelves / bookcases","Wardrobes / storage","Other furniture"],keywords:["assembly","assemble","ikea","bed","desk","furniture"]},
    {slug:"handyman",name:"Handyman",summary:"Basic non-structural home repairs and simple installations.",question:"What handyman help do you need?",options:["Small home repairs","Mounting / shelves","Curtains / blinds","Simple door hardware","Other basic handyman work"],keywords:["repair","mounting","odd jobs","small repairs"]},
    {slug:"drywall",name:"Drywall",summary:"Drywall patches, repair, replacement, finishing and texture within the allowed scope.",question:"What drywall service do you need?",options:["Patch / repair","New drywall installation","Drywall replacement","Finishing / texture","Ceiling drywall","Other drywall work"],keywords:["sheetrock","wall patch","texture","drywall repair"]},
    {slug:"yard-cleanup-other-cleanup",name:"Yard Cleanup & Other Cleanup",summary:"Leaves, grass clippings, branches, palm fronds and other basic cleanup needs.",question:"What kind of cleanup do you need?",options:["Leaves / grass clippings","Branches / palm fronds","General yard cleanup","Other basic cleanup","Not sure yet"],keywords:["yard cleaning","debris cleanup","leaves","palm fronds","garden cleanup"]},
    {slug:"lawn-care-gardening",name:"Lawn Care & Gardening",summary:"Lawn mowing, edging, planting and routine gardening (no pesticide applications).",question:"What lawn or gardening service do you need?",options:["Lawn mowing","Edging / trimming","Garden maintenance","Planting flowers / plants","Mulching / basic landscaping","Other routine gardening"],keywords:["mowing","lawn","gardener","grass","yard service"]},
    {slug:"pool-cleaning",name:"Pool Cleaning",summary:"Routine cleaning of private residential pools (no equipment repairs).",question:"What pool cleaning do you need?",options:["One-time pool cleaning","Recurring pool cleaning","Skimming / vacuuming","Filter cleaning","Other basic pool cleaning"],keywords:["pool cleaner","swimming pool","pool maintenance"]},
    {slug:"window-cleaning",name:"Window Cleaning",summary:"Residential window and glass cleaning.",question:"What windows need cleaning?",options:["Interior windows","Exterior windows","Both sides","Glass doors / screens","Other window cleaning"],keywords:["windows","glass cleaning","window washing"]},
    {slug:"carpet-upholstery-cleaning",name:"Carpet & Upholstery Cleaning",summary:"Carpet, area rug, sofa and upholstered furniture cleaning.",question:"What needs carpet or upholstery cleaning?",options:["Wall-to-wall carpet","Area rugs","Sofa / couch","Upholstered chairs","Other carpet / upholstery"],keywords:["carpet","rug","couch","sofa","upholstery"]},
    {slug:"other-services",name:"Other Services",summary:"Describe a service not listed above; the request is reviewed before being offered to providers.",question:"What type of service do you need?",options:["Other service / not listed","Not sure how to categorize"],keywords:["other","not listed","miscellaneous","something else"],minDescriptionLength:60,reviewRequired:true,generalAudience:true}
  ];
  const MIN_OTHER_DESCRIPTION = 60;
  const api = Object.freeze({
    categories,
    names: categories.map(c => c.name),
    MIN_OTHER_DESCRIPTION,
    findByName(name) { return categories.find(c => c.name === String(name || "").trim()) || null; },
    findBySlug(slug) { return categories.find(c => c.slug === String(slug || "").trim()) || null; },
    isEnabled(name) { return Boolean(this.findByName(name)); },
    href(category) { return category.slug === "house-cleaning" ? "quote-flow-house-cleaning.html" : "quote-flow-standard.html?service=" + encodeURIComponent(category.slug); }
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.GetEstimateFastLaunch = api;
})(typeof window !== "undefined" ? window : null);
