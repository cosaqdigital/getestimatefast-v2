-- GetEstimateFast US Development - atomic automatic pricing for profile-origin leads.
-- Prepare in GitHub; apply ONLY to cpjsbijgijeyrwjpuciv after review.
-- An active USD pricing rule is required for the approved category.
-- The originating professional remains free and is NOT included in paid-buyer capacity.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_publish_profile_opportunity_priced(
  p_lead_id uuid,
  p_public_summary text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_source text;
  v_origin uuid;
  v_category text;
  v_rule uuid;
  v_published jsonb;
  v_opportunity uuid;
  v_terms jsonb;
  v_terms_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=p_actor) THEN
    RAISE EXCEPTION 'Administrator not authorized';
  END IF;

  SELECT l.source,l.origin_contractor_id,l.service_type
  INTO v_source,v_origin,v_category
  FROM public.leads l
  WHERE l.id=p_lead_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_source IS DISTINCT FROM 'professional_profile' OR v_origin IS NULL THEN
    RAISE EXCEPTION 'Not a professional-profile-origin request';
  END IF;

  SELECT r.id INTO v_rule
  FROM public.marketplace_price_rules r
  WHERE r.category=v_category
    AND r.currency='USD'
    AND r.effective_at<=now()
  ORDER BY r.effective_at DESC,r.created_at DESC,r.id DESC
  LIMIT 1;
  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Configure an active USD contact-price rule for this service before publishing';
  END IF;

  v_published:=public.admin_publish_opportunity(p_lead_id,p_public_summary,p_actor);
  v_opportunity:=(v_published->>'opportunity_id')::uuid;
  IF v_opportunity IS NULL THEN RAISE EXCEPTION 'No published opportunity returned'; END IF;

  -- Production may already assign commercial terms through the publish trigger.
  -- Reuse that immutable row; only create terms if the trigger did not.
  SELECT t.id INTO v_terms_id
  FROM gef_private.opportunity_terms t
  JOIN public.opportunity_previews o ON o.id=t.opportunity_id
  WHERE t.opportunity_id=v_opportunity
    AND t.published_at_snapshot=o.published_at
  ORDER BY t.id
  LIMIT 1;

  IF v_terms_id IS NULL THEN
    v_terms:=public.gef_admin_configuration(
      p_actor,
      'opportunity_terms',
      jsonb_build_object(
        'opportunity_id',v_opportunity,
        'rule_id',v_rule,
        'scope_key',null,
        'urgency_key',null
      ),
      'Automatic USD contact pricing for profile-origin opportunity',
      'profile-terms:'||v_opportunity::text
    );
    v_terms_id:=(v_terms->>'id')::uuid;
  END IF;

  IF v_terms_id IS NULL THEN RAISE EXCEPTION 'Failed to assign commercial terms'; END IF;
  RETURN v_published || jsonb_build_object(
    'origin_professional_free',true,
    'commercial_terms_assigned',true,
    'commercial_terms_id',v_terms_id
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_publish_profile_opportunity_priced(uuid,text,uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_profile_opportunity_priced(uuid,text,uuid)
TO service_role;
COMMIT;
