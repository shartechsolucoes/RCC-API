import crypto from "node:crypto";
import path from "node:path";

import { Router } from "express";
import multer from "multer";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const uploadsDir = path.join(__dirname, "../../../uploads");

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TO_EXT[file.mimetype] ?? "";
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
      cb(new Error("Tipo de arquivo não permitido. Envie PNG, JPG, WEBP ou GIF."));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/", (req, res) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }

    const baseUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3333}`;
    res.status(201).json({ url: `${baseUrl}/uploads/${req.file.filename}` });
  });
});

export default router;
