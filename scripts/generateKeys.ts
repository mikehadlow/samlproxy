import { spawnSync } from "bun";
import * as fs from "fs";
import * as path from "path";

const getEnvVar = (name: string): string => {
  if (!process.env[name]) {
    console.error(`Environment variable ${name} is not set`);
    process.exit(1);
  }
  return process.env[name]!;
};

const generateKeys = (
  certBase: string,
  certPw: string,
  privateKey: string,
  cert: string,
) => {
  const cwd = process.cwd();
  // if samlProxyCertBase is not a rooted directory path join it with cwd
  if (!path.isAbsolute(certBase)) {
    certBase = path.join(cwd, certBase);
  }

  // if cert base is not a directory, create it
  if (!fs.existsSync(certBase)) {
    fs.mkdirSync(certBase, { recursive: true });
  }

  // generate the private key (.pem file) with the given password.
  const privateKeyPath = path.join(certBase, privateKey);
  const privateKeyGenerated = spawnSync([
    "openssl",
    "genrsa",
    "-passout",
    `pass:${certPw}`,
    "-out",
    privateKeyPath,
    "4096",
  ]);
  if (!privateKeyGenerated.success) {
    console.error(
      `Failed to generate private key ${privateKeyGenerated.stderr}`,
    );
    process.exit(1);
  }

  // generate the certificate (.crt file) with the given password.
  const certPath = path.join(certBase, cert);
  const certGenerated = spawnSync([
    "openssl",
    "req",
    "-new",
    "-x509",
    "-key",
    privateKeyPath,
    "-out",
    certPath,
    "-days",
    "365",
    "-subj",
    "/C=UK/ST=London/L=London/O=SAMLPROXY/CN=localhost",
  ]);
  if (!certGenerated.success) {
    console.error(`Failed to generate certificate ${certGenerated.stderr}`);
    process.exit(1);
  }
};

const run = async () => {
  // generate keys for the SAML Proxy
  const samlProxyCertBase = getEnvVar("SAML_PROXY_CERT_BASE");
  const samlProxyCertPw = getEnvVar("SAML_PROXY_CERT_PW");
  const samlProxyPrivateKey = getEnvVar("SAML_PROXY_PRIVATE_KEY");
  const samlProxyCert = getEnvVar("SAML_PROXY_CERT");

  console.log(`Generating keys for the SAML Proxy in ${samlProxyCertBase}`);
  generateKeys(
    samlProxyCertBase,
    samlProxyCertPw,
    samlProxyPrivateKey,
    samlProxyCert,
  );

  // generate keys for the Test IdP
  const testIdpCertBase = getEnvVar("TEST_IDP_CERT_BASE");
  const testIdpCertPw = getEnvVar("TEST_IDP_CERT_PW");
  const testIdpPrivateKey = getEnvVar("TEST_IDP_PRIVATE_KEY");
  const testIdpCert = getEnvVar("TEST_IDP_CERT");

  console.log(`Generating keys for the Test IdP in ${testIdpCertBase}`);
  generateKeys(testIdpCertBase, testIdpCertPw, testIdpPrivateKey, testIdpCert);
};

run();
