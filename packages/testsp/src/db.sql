CREATE TABLE relay_state (
    relay_state TEXT PRIMARY KEY,
    email TEXT,
    timestamp INT,
    used INT -- 1 or 0
) STRICT
;
