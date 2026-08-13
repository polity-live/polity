CREATE OR REPLACE FUNCTION public.delete_inactive_dataset_search_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    DELETE FROM public.search_document
    WHERE id = public.search_document_id('dataset', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_inactive_dataset_search_document() FROM PUBLIC;

CREATE TRIGGER trg_zz_search_document_dataset_archive
AFTER INSERT OR UPDATE ON public.dataset
FOR EACH ROW EXECUTE FUNCTION public.delete_inactive_dataset_search_document();
