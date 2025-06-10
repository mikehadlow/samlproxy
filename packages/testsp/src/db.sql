CREATE TABLE relay_state (
    relay_state TEXT PRIMARY KEY,
    email TEXT,
    timestamp INT,
    used INT -- 1 or 0
) STRICT
;

CREATE TABLE user (
    email TEXT PRIMARY KEY,
    idp_entity_id TEXT
)
;
