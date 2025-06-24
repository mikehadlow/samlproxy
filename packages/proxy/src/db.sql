CREATE TABLE relay_state (
    relay_state TEXT PRIMARY KEY,
    request_id TEXT,
    sp_entity_id TEXT,
    timestamp INT,
    used INT -- 1 or 0
) STRICT
;

CREATE TABLE sp_to_idp_link (
    sp_entity_id TEXT,
    idp_entity_id TEXT
) STRICT
;
