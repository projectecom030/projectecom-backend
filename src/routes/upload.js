const express = require("express")
const multer = require("multer")
const { PutObjectCommand } = require("@aws-sdk/client-s3")
const { v4: uuidv4 } = require("uuid")
const { s3, endpoint, publicEndpoint } = require("../config/minio")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

const upload = multer({ storage: multer.memoryStorage() })

router.post("/images", authenticateToken, upload.array("images"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      })
    }

    if (!process.env.MINIO_BUCKET || !endpoint || !publicEndpoint) {
      return res.status(500).json({
        success: false,
        message: "MinIO config missing. Set MINIO_BUCKET and MINIO endpoint in .env",
      })
    }

    const imageUrls = []

    for (const file of req.files) {

      const key = `images/${uuidv4()}-${file.originalname}`

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.MINIO_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype
        })
      )

      const url = `${publicEndpoint}/${process.env.MINIO_BUCKET}/${key}`

      imageUrls.push(url)
    }

    res.json({
      success: true,
      imageUrls
    })

  } catch (err) {
    console.error("Upload images error:", err)

    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message,
      storageEndpoint: endpoint,
      bucket: process.env.MINIO_BUCKET,
    })
  }
})

module.exports = router
