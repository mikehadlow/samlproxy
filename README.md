# samlproxy
An an example implementation of a SAML IdP Proxy

## TODO:
1. Super basic TestSp talking to super basic TestIdP.
1. Configure with SQL Lite.

## Useful links
* [SAML Technical Spec](https://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0-cd-02.html)
* [SAML XML Entity Spec](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf)
* [Samlify Docs](https://samlify.js.org/#/?id=samlify)


## Development
SamlProxy uses bun. Install bun by following the instructions on the [bun website](https://bun.sh/docs/installation)

This is a monorepo containing 3 packages:
1. `proxy`: This is the core proxy package.
1. `testsp`: This is a test SAML service provider (SP). This mimics the application that needs to authenticate.
1. `testidp`: This is test SAML identity provider (IdP). This mimics an identity provider, such as Okta or Auth0.

All 3 packages run together using the [overmind](https://github.com/DarthSim/overmind) process manager. Install it with:
```zsh
brew install tmux
brew install overmind
```

Start with:
```zsh
bun run dev
```
Overmind will start all three processes at the following URLs:

| process | URL |
|---|---|
| proxy | <http://localhost:7272> |
| sp    | <http://localhost:7282> |
| idp   | <http://localhost:7292> |
