CREATE TABLE idp_connection (
    -- IdP (their) properties
    idp_entity_id TEXT PRIMARY KEY,
    idp_sso_url TEXT,
    signing_certificate TEXT,
    -- SP (my) properties
    sp_entity_id TEXT,
    sp_acs_url TEXT
) STRICT
;
