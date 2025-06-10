CREATE TABLE idp_connection (
    -- SP (my) properties
    sp_entity_id TEXT PRIMARY KEY,
    sp_acs_url TEXT,
    -- IdP (their) properties
    idp_entity_id TEXT,
    idp_sso_url TEXT,
    signing_certificate TEXT
) STRICT
;
