import * as fs from "fs"
import * as path from "path"
import * as r from "./result"

type Keys = {
  encryptionKey: string,
  encryptionKeyPw: string,
  certificate: string,
}

type Certificate = {
  certificate: string,
}

export const loadKeys = (args: {
  keysBasePath: string,
  encryptionKeyFile: string,
  encryptionKeyPw: string,
  certificateFile: string,
}): r.Result<Keys> => {
  const {
    keysBasePath,
    encryptionKeyFile,
    encryptionKeyPw,
    certificateFile,
  } = args

  // if keysBasePath is not a rooted path, combine it with the project rooted path
  const keysPath = (path.isAbsolute(keysBasePath))
    ? keysBasePath
    : path.join(__dirname, "../../..", keysBasePath)

  const encryptionKey = fs.readFileSync(path.join(keysPath, encryptionKeyFile), "utf-8")
  if (!encryptionKey) {
    return r.fail("Missing encryptionKey")
  }
  const certificate = fs.readFileSync(path.join(keysPath, certificateFile), "utf-8")
  if (!certificate) {
    return r.fail("Missing certificate")
  }
  return r.from({
    encryptionKey,
    encryptionKeyPw,
    certificate,
  })
}

export const loadCertificate = (args: {
  keysBasePath: string,
  certificateFile: string,
}): r.Result<Certificate> => {
  const {
    keysBasePath,
    certificateFile,
  } = args

  // if keysBasePath is not a rooted path, combine it with the project rooted path
  const keysPath = (path.isAbsolute(keysBasePath))
    ? keysBasePath
    : path.join(__dirname, "../../..", keysBasePath)

  const certificate = fs.readFileSync(path.join(keysPath, certificateFile), "utf-8")
  if (!certificate) {
    return r.fail("Missing certificate")
  }
  return r.from({
    certificate,
  })
}
