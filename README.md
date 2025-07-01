# samlproxy
An an example implementation of a SAML IdP Proxy

# How it works

```mermaid
block-beta
columns 1
    base

    block
    columns 3
      a
      b
      abc
    end
    block
      block
        1
      end
      space
      3
    end
```

```mermaid
block-beta
columns 6
    block:SP:1
    columns 1
      SP
      ACS
    end
    space:1
    block:Proxy:2
    columns 2
      SSO
      Proxy
      Proxy
      ACS
    end
    space:1
    block:IdP:1
    columns 1
      SSO
      IdP
    end
```

```mermaid
sequenceDiagram
    participant Browser
    participant SP as Service Provider (SP)
    participant Proxy as SAML Proxy
    participant IdP as Identity Provider (IdP)

    Note over Browser,IdP: SAML SSO Login Flow

    Browser->>SP: 1. Access protected resource
    SP->>SP: 2. Check authentication status
    SP->>SP: 3. Generate SAML AuthnRequest
    SP->>Browser: 4. HTTP 302 Redirect with AuthnRequest<br/>(Redirect Binding)

    Note over Browser,Proxy: User redirected to Proxy

    Browser->>Proxy: 5. GET request with SAML AuthnRequest<br/>(via redirect URL parameters)
    Proxy->>Proxy: 6. Validate AuthnRequest
    Proxy->>Proxy: 6. Lookup IdP connection based on request
    Proxy->>Browser: 4. HTTP 302 Redirect with AuthnRequest<br/>(Redirect Binding)

    Note over Proxy,IdP: User redirected to IdP

    Browser->>IdP: 5. GET request with SAML AuthnRequest<br/>(via redirect URL parameters)
    IdP->>IdP: 6. Validate AuthnRequest
    IdP->>Browser: 7. Present login form
    Browser->>IdP: 8. Submit credentials
    IdP->>IdP: 9. Authenticate user
    IdP->>IdP: 10. Generate SAML Assertion
    IdP->>Browser: 11. Return HTML form with SAML Response<br/>(POST Binding setup)

    Note over Browser,SP: Auto-submit form back to Proxy

    Browser->>Proxy: 12. POST SAML Response with Assertion<br/>(POST Binding)
    Proxy->>Proxy: 13. Validate SAML Assertion
    Proxy->>Proxy: 14. Extract user attributes
    Proxy->>Proxy: 14. Lookup SP connection based on assertion
    Proxy->>Proxy: 10. Generate New SAML Assertion
    Proxy->>Browser: 11. Return HTML form with SAML Response<br/>(POST Binding setup)

    Note over Browser,SP: Auto-submit form back to SP

    Browser->>SP: 12. POST SAML Response with Assertion<br/>(POST Binding)
    SP->>SP: 13. Validate SAML Assertion
    SP->>SP: 14. Extract user attributes
    SP->>SP: 15. Create user session
    SP->>Browser: 16. Grant access to protected resource

    Note over Browser,SP: User successfully authenticated
```

## Useful links
* [SAML Technical Spec](https://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0-cd-02.html)
* [SAML XML Entity Spec](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf)
* [Samlify Docs](https://samlify.js.org/#/?id=samlify)


## Development
SamlProxy uses bun. Install bun by following the instructions on the [bun website](https://bun.sh/docs/installation)

Environment variables are held in `.envrc`. You should copy `.envrc.template` and fill in the required env vars. This project uses [direnv](https://direnv.net/) to populate env vars for local development:
```zsh
brew install direnv
```

This is a monorepo containing 3 packages:
1. `proxy`: This is the core proxy package.
1. `testsp`: This is a test SAML service provider (SP). This mimics the application that needs to authenticate.
1. `testidp`: This is test SAML identity provider (IdP). This mimics an identity provider, such as Okta or Auth0.

Start with:
```zsh
bun run dev
```
The script `scripts/cluster.ts` will start all three processes at the following URLs:

| process | URL |
|---|---|
| proxy | <http://localhost:7272> |
| sp    | <http://localhost:7282> |
| idp   | <http://localhost:7292> |
