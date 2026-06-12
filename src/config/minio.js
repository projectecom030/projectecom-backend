const https = require("https")
const { S3Client } = require("@aws-sdk/client-s3")
const { NodeHttpHandler } = require("@smithy/node-http-handler")

const trimTrailingSlash = (value) => value?.trim().replace(/\/+$/, "")
const parseBoolean = (value) => String(value).toLowerCase() === "true"

const endpoint = trimTrailingSlash(process.env.MINIO_S3_ENDPOINT || process.env.MINIO_ENDPOINT)
const accessKeyId = process.env.MINIO_ACCESS_KEY
const secretAccessKey = process.env.MINIO_SECRET_KEY
const region = process.env.MINIO_REGION || "us-east-1"
const tlsRejectUnauthorized = process.env.MINIO_TLS_REJECT_UNAUTHORIZED !== "false"
const connectionTimeout = Number(process.env.MINIO_CONNECTION_TIMEOUT_MS || 5000)
const requestTimeout = Number(process.env.MINIO_REQUEST_TIMEOUT_MS || 15000)

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.warn("MinIO is not fully configured. Check MINIO_ENDPOINT/MINIO_S3_ENDPOINT and credentials.")
}

const requestHandlerOptions = {
  connectionTimeout,
  requestTimeout,
}

if (endpoint?.startsWith("https://") && !tlsRejectUnauthorized) {
  requestHandlerOptions.httpsAgent = new https.Agent({ rejectUnauthorized: false })
}

const s3Config = {
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: process.env.MINIO_FORCE_PATH_STYLE
    ? parseBoolean(process.env.MINIO_FORCE_PATH_STYLE)
    : true,
  requestHandler: new NodeHttpHandler(requestHandlerOptions),
}

const s3 = new S3Client(s3Config)

module.exports = {
  s3,
  endpoint,
  publicEndpoint: trimTrailingSlash(process.env.MINIO_PUBLIC_ENDPOINT) || endpoint,
}
