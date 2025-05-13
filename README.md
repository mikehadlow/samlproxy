# samlproxy
An an example implementation of a SAML IdP Proxy

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

## TODO:
1. Setup multi-package bun project. DONE
1. Setup Hono server for each project.
