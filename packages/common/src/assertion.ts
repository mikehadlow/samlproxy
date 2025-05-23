import * as e from "./entity"
import Mustache from "mustache"

export const createTemplateCallback = (args: {
  connection: e.SpConnection,
  user: e.User,
  requestId: string,
}) => (template: string) => {
  const {
    connection,
    user,
    requestId,
  } = args
  const id = `_${crypto.randomUUID()}`
  const now = new Date()
  const fiveMinutesLater = new Date(now.getTime())
  fiveMinutesLater.setMinutes(fiveMinutesLater.getMinutes() + 5)
  const tvalue = {
    ID: id,
    AssertionID:  `_${crypto.randomUUID()}`,
    Destination: connection.spAcsUrl,
    Audience: connection.spEntityId,
    SubjectRecipient: connection.spEntityId,
    NameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    NameID: user.email,
    Issuer: connection.idpEntityId,
    IssueInstant: now.toISOString(),
    ConditionsNotBefore: now.toISOString(),
    ConditionsNotOnOrAfter: fiveMinutesLater.toISOString(),
    SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater.toISOString(),
    AssertionConsumerServiceURL: connection.spAcsUrl,
    EntityID: connection.spEntityId,
    InResponseTo: requestId,
    StatusCode: "urn:oasis:names:tc:SAML:2.0:status:Success",
  }
  return {
    id: id,
    context: Mustache.render(template, tvalue),
  }
}
