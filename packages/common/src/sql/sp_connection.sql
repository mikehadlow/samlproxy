CREATE TABLE sp_connection (
    id TEXT PRIMARY KEY,
    name TEXT,
    -- SP (their) properties
    sp_entity_id TEXT,
    sp_acs_url TEXT,
    -- IdP (my) properties
    idp_entity_id TEXT,
    idp_sso_url TEXT,
    private_key TEXT,
    private_key_password TEXT,
    signing_certificate TEXT
) STRICT
;
