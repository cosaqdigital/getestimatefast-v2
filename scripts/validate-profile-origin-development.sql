-- Diagnostic only: run exclusively against cpjsbijgijeyrwjpuciv.
-- Every synthetic write is rolled back by the inner exception subtransaction.
-- Does not replace the authenticated hosted browser walkthrough.
DO $qa$
#variable_conflict use_variable
DECLARE
  owner_id uuid := '3c02828a-30b5-4ab4-aa79-480f7ead5ec6';
  other_id uuid := '40c1fdf0-3e0f-4ced-9642-d00a154b4dcc';
  actor_id uuid;
  lead_id uuid := gen_random_uuid();
  token_id uuid := gen_random_uuid();
  opportunity_id uuid;
  quote_id uuid;
  published jsonb;
  baseline jsonb;
  after_state jsonb;
  attempted boolean;
  expected_error text;
BEGIN
  SELECT user_id INTO STRICT actor_id FROM public.admin_users;
  SELECT jsonb_build_object(
    'wallet',public.gef_wallet_summary(owner_id),
    'ledger',(SELECT count(*) FROM gef_private.ledger),
    'purchases',(SELECT count(*) FROM gef_private.contact_purchases),
    'payments',(SELECT count(*) FROM gef_private.payment_intents),
    'orders',(SELECT count(*) FROM gef_private.test_checkout_orders)
  ) INTO baseline;
  BEGIN
    SET LOCAL ROLE service_role;
    INSERT INTO public.leads(id,submission_token,source,origin_contractor_id,
      service_type,full_name,email,phone,city,zip_code,status,details)
    VALUES(lead_id,token_id,'professional_profile',owner_id,'Painting',
      'TEST ONLY PR70 rollback diagnostic','pr70-rollback@example.invalid',
      '8135550100','Riverview','33569','new',
      '{"_profile_referral":{"origin_slug":"cosaquevitecorp","customer_share_accepted":true,"consent_version":"profile-request-v1"},"_platform_review":{"required":true}}');
    -- Retry of the same operation cannot insert another record.
    INSERT INTO public.leads(submission_token,service_type,full_name,email,phone,city,zip_code)
    VALUES(token_id,'Painting','TEST ONLY PR70 rollback diagnostic',
      'pr70-rollback@example.invalid','8135550100','Riverview','33569')
    ON CONFLICT(submission_token) DO NOTHING;
    IF (SELECT count(*) FROM public.leads WHERE submission_token=token_id)<>1
      THEN RAISE EXCEPTION 'QA duplicate operation'; END IF;
    -- A different operation with identical contact details is legitimate.
    INSERT INTO public.leads(submission_token,service_type,full_name,email,phone,city,zip_code)
    VALUES(gen_random_uuid(),'Painting','TEST ONLY PR70 rollback diagnostic',
      'pr70-rollback@example.invalid','8135550100','Riverview','33569');

    attempted:=false;
    BEGIN
      UPDATE public.leads SET origin_contractor_id=other_id WHERE id=lead_id;
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS expected_error=MESSAGE_TEXT;
      IF expected_error<>'Profile lead origin is immutable' THEN RAISE; END IF;
      attempted:=true;
    END;
    IF NOT attempted THEN RAISE EXCEPTION 'QA origin reassignment allowed'; END IF;

    attempted:=false;
    BEGIN
      PERFORM public.admin_publish_profile_opportunity_priced(lead_id,
        'TEST ONLY synthetic interior painting project for diagnostic validation.',actor_id);
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS expected_error=MESSAGE_TEXT;
      IF expected_error<>'Only approved, unpublished requests can be published' THEN RAISE; END IF;
      attempted:=true;
    END;
    IF NOT attempted THEN RAISE EXCEPTION 'QA publication before review allowed'; END IF;
    IF EXISTS(SELECT 1 FROM public.opportunity_previews WHERE public.opportunity_previews.lead_id=lead_id)
      THEN RAISE EXCEPTION 'QA premature opportunity'; END IF;

    PERFORM public.admin_approve_lead(lead_id,'Painting',true,true,'TEST ONLY rollback validation',actor_id);
    attempted:=false;
    BEGIN
      PERFORM public.admin_approve_lead(lead_id,'Painting',true,true,'TEST ONLY rollback validation',actor_id);
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS expected_error=MESSAGE_TEXT;
      IF expected_error<>'Lead has already been reviewed or changed; reload before proceeding' THEN RAISE; END IF;
      attempted:=true;
    END;
    IF NOT attempted THEN RAISE EXCEPTION 'QA repeat approval accepted'; END IF;

    published:=public.admin_publish_profile_opportunity_priced(lead_id,
      'TEST ONLY synthetic interior painting project for diagnostic validation.',actor_id);
    opportunity_id:=(published->>'opportunity_id')::uuid;
    IF published->>'origin_professional_free'<>'true' OR opportunity_id IS NULL
      THEN RAISE EXCEPTION 'QA missing free origin result'; END IF;
    IF (SELECT status FROM public.leads WHERE id=lead_id)<>'published'
      THEN RAISE EXCEPTION 'QA publication not persisted'; END IF;
    IF (SELECT count(*) FROM gef_private.opportunity_terms t WHERE t.opportunity_id=opportunity_id)<>1
      THEN RAISE EXCEPTION 'QA commercial terms count'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.list_contractor_opportunities(other_id,0,null) o
      WHERE o.opportunity_id=opportunity_id) THEN RAISE EXCEPTION 'QA other contractor excluded'; END IF;
    IF jsonb_array_length(public.gef_commercial_previews(ARRAY[opportunity_id]))<>1
      THEN RAISE EXCEPTION 'QA missing paid commercial preview'; END IF;

    attempted:=false;
    BEGIN
      PERFORM public.admin_publish_profile_opportunity_priced(lead_id,
        'TEST ONLY synthetic interior painting project for diagnostic validation.',actor_id);
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS expected_error=MESSAGE_TEXT;
      IF expected_error<>'Only approved, unpublished requests can be published' THEN RAISE; END IF;
      attempted:=true;
    END;
    IF NOT attempted THEN RAISE EXCEPTION 'QA repeat publication accepted'; END IF;
    IF (SELECT count(*) FROM gef_private.opportunity_terms t WHERE t.opportunity_id=opportunity_id)<>1
      THEN RAISE EXCEPTION 'QA duplicate terms'; END IF;

    -- Exercise the installed guard without funding a wallet or purchasing anything.
    SELECT (public.gef_create_test_quote(owner_id,t.id,100,now()+interval '1 minute')->>'quote_id')::uuid
      INTO quote_id FROM gef_private.opportunity_terms t WHERE t.opportunity_id=opportunity_id;
    attempted:=false;
    BEGIN
      INSERT INTO gef_private.contact_purchases(contractor_id,opportunity_id,quote_id,amount_cents,operation_key)
      VALUES(owner_id,opportunity_id,quote_id,100,'qa-pr70-origin:'||lead_id::text);
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS expected_error=MESSAGE_TEXT;
      IF expected_error<>'The originating professional receives this contact without charge' THEN RAISE; END IF;
      attempted:=true;
    END;
    IF NOT attempted THEN RAISE EXCEPTION 'QA paid origin accepted'; END IF;
    SELECT jsonb_build_object(
      'wallet',public.gef_wallet_summary(owner_id),
      'ledger',(SELECT count(*) FROM gef_private.ledger),
      'purchases',(SELECT count(*) FROM gef_private.contact_purchases),
      'payments',(SELECT count(*) FROM gef_private.payment_intents),
      'orders',(SELECT count(*) FROM gef_private.test_checkout_orders)
    ) INTO after_state;
    IF after_state IS DISTINCT FROM baseline THEN RAISE EXCEPTION 'QA financial state changed'; END IF;
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='QA complete: roll back all synthetic writes';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.leads WHERE id=lead_id OR submission_token=token_id)
    THEN RAISE EXCEPTION 'QA rollback incomplete'; END IF;
END $qa$;
SELECT 'PASS: reviewed publication, paid peer visibility, origin purchase guard, retries, immutable origin, unchanged finance, all writes rolled back' AS diagnostic_result;
