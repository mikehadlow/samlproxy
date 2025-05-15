import * as samlify from "samlify"

// This file declares two entities, an idpConnection, and an spConnection.

// An idpConnection encapsulates an SP's connection to an IdP. So it is responsible
// for creating the intial SP-initiated AuthnRequest, and also for consuming
// the Assertion returned by the IdP at the Assertion Consumer Service endpoint.
export type IdpConnection = {
  // SP (my) properties
  spEntityId: string,
  spAcsUrl: string,
  // IdP (their) properties
  idpEntityId: string,
  idpSsoUrl: string,
  cert: string,
}

// An spConnection encapsulates an IdP's connection to an SP. So it is responsible
// for consuming an SP-initiated AuthnRequest, authenticating the principle, and
// constructing and signing the assertion.
export type SpConnection = {
  // IdP (my) properties
  idpEntityId: string,
  idpSsoUrl: string,
  cert: string,
  // SP (their) properties
  spEntityId: string,
  spAcsUrl: string,
}

export type AuthnRequest = {
  url: string,
}

export const generateAuthnRequest = (connection: IdpConnection): AuthnRequest => {
  const sp = samlify.ServiceProvider({
    entityID: connection.spEntityId,
  })
  const idp = samlify.IdentityProvider({
    entityID: connection.idpEntityId,
    singleSignOnService: [{
      Binding: samlify.Constants.BindingNamespace.Redirect,
      Location: connection.idpSsoUrl,
    }],
    // Samlify expects this even though we don't need it here.
    singleLogoutService: [{
      Binding: samlify.Constants.BindingNamespace.Redirect,
      Location: connection.idpSsoUrl,
    }],
  })
  const { context } = sp.createLoginRequest(idp, 'redirect')
  return {
    url: context,
  }
}
