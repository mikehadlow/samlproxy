import * as fs from "fs"
import * as path from "path"
import * as r from "./result"

type Keys = {
  encryptionKey: string,
  encryptionKeyPw: string,
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

  const encryptionKey = fs.readFileSync(path.join(keysBasePath, encryptionKeyFile), "utf-8")
  if (!encryptionKey) {
    return r.fail("Missing encryptionKey")
  }
  const certificate = fs.readFileSync(path.join(keysBasePath, certificateFile), "utf-8")
  if (!certificate) {
    return r.fail("Missing certificate")
  }
  return r.from({
    encryptionKey,
    encryptionKeyPw,
    certificate,
  })
}
