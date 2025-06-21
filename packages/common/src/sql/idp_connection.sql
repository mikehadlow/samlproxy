CREATE TABLE idp_connection (
    id TEXT PRIMARY KEY,
    name TEXT,
    -- IdP (their) properties
    idp_entity_id TEXT,
    idp_sso_url TEXT,
    signing_certificate TEXT,
    -- SP (my) properties
    sp_entity_id TEXT,
    sp_acs_url TEXT,
    sp_allow_idp_initiated INT -- 0 or 1
) STRICT
;
