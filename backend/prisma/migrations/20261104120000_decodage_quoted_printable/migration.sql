-- Emails reçus avant mailparser : corps restés encodés en quoted-printable
-- (« r=C3=A9seau » au lieu de « réseau »). Décodage UTF-8 ; texte laissé tel quel si invalide.
CREATE FUNCTION pg_temp.decoder_qp(t TEXT) RETURNS TEXT AS $$
DECLARE
  s TEXT := regexp_replace(t, E'=\r?\n', '', 'g');
  res BYTEA := ''::BYTEA;
  i INT := 1;
  n INT := length(s);
  hex TEXT;
BEGIN
  WHILE i <= n LOOP
    hex := substr(s, i + 1, 2);
    IF substr(s, i, 1) = '=' AND hex ~ '^[0-9A-Fa-f]{2}$' THEN
      res := res || decode(hex, 'hex');
      i := i + 3;
    ELSE
      res := res || convert_to(substr(s, i, 1), 'UTF8');
      i := i + 1;
    END IF;
  END LOOP;
  RETURN convert_from(res, 'UTF8');
EXCEPTION WHEN OTHERS THEN
  RETURN t;
END;
$$ LANGUAGE plpgsql;

UPDATE "Communication" SET "contenu" = pg_temp.decoder_qp("contenu")
WHERE "statut" = 'Reçu' AND "contenu" ~ '=[0-9A-F]{2}';

UPDATE "Communication" SET "retour" = pg_temp.decoder_qp("retour")
WHERE "retour" IS NOT NULL AND "retour" ~ '=[0-9A-F]{2}';
