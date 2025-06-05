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

CREATE TABLE sp_connection (
    -- IdP (my) properties
    idp_entity_id TEXT PRIMARY KEY,
    idp_sso_url TEXT,
    private_key TEXT,
    private_key_password TEXT,
    signing_certificate TEXT,
    -- SP (their) properties
    sp_entity_id TEXT,
    sp_acs_url TEXT
) STRICT
;
