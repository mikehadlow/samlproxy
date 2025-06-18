CREATE TABLE sp_connection (
    -- SP (their) properties
    sp_entity_id TEXT PRIMARY KEY,
    sp_acs_url TEXT,
    -- IdP (my) properties
    idp_entity_id TEXT,
    idp_sso_url TEXT,
    private_key TEXT,
    private_key_password TEXT,
    signing_certificate TEXT
) STRICT
;
