/**
 * Module de stockage — client S3 pour Hetzner Object Storage.
 *
 * Hetzner Object Storage est compatible avec l'API S3 d'AWS.
 * Les fichiers ne sont PAS publics : l'accès se fait uniquement via signed URLs.
 *
 * Variables d'environnement requises :
 *   HETZNER_S3_ENDPOINT    — ex: https://fsn1.your-objectstorage.com
 *   HETZNER_S3_BUCKET      — nom du bucket (ex: dkfarm-prod)
 *   HETZNER_S3_ACCESS_KEY  — clé d'accès S3
 *   HETZNER_S3_SECRET_KEY  — clé secrète S3
 *
 * Usage :
 *   import { uploadFile, deleteFile, getSignedUrl, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/storage";
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Constantes de validation
// ---------------------------------------------------------------------------

/** Types MIME autorisés pour l'upload de factures */
export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

/** Taille max d'un fichier uploadé : 10 Mo */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB en bytes

/** Durée de validité d'une signed URL : 1 heure */
export const SIGNED_URL_EXPIRES_IN = 3600; // secondes

// ---------------------------------------------------------------------------
// Client S3 (singleton)
// ---------------------------------------------------------------------------

function createS3Client() {
  const endpoint = process.env.HETZNER_S3_ENDPOINT;
  const accessKeyId = process.env.HETZNER_S3_ACCESS_KEY;
  const secretAccessKey = process.env.HETZNER_S3_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Configuration S3 manquante. Vérifier HETZNER_S3_ENDPOINT, HETZNER_S3_ACCESS_KEY, HETZNER_S3_SECRET_KEY dans .env"
    );
  }

  return new S3Client({
    endpoint,
    region: "eu-central-1", // Requis par le client AWS SDK, valeur symbolique pour Hetzner
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // Hetzner utilise le style path (bucket dans l'URL, pas dans le hostname)
  });
}

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = createS3Client();
  }
  return _s3Client;
}

function getBucket(): string {
  const bucket = process.env.HETZNER_S3_BUCKET;
  if (!bucket) {
    throw new Error("Variable d'environnement HETZNER_S3_BUCKET manquante");
  }
  return bucket;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Valide qu'un fichier respecte les contraintes (MIME + taille).
 * Lève une Error avec un message descriptif si invalide.
 */
export function validateFile(file: { size: number; type: string; name: string }): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    throw new Error(
      `Type de fichier non autorisé : ${file.type}. Formats acceptés : PDF, JPG, PNG.`
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Fichier trop volumineux : ${sizeMb} Mo. La taille maximum est 10 Mo.`
    );
  }
}

// ---------------------------------------------------------------------------
// Convention de nommage des fichiers
// ---------------------------------------------------------------------------

/**
 * Génère la clé S3 pour un fichier, organisée par site.
 * Format : farm-flow/{siteId}/{category}/{entityId}/{timestamp}-{nomFichierNettoyé}
 */
export function generateStorageKey(
  siteId: string,
  category: string,
  entityId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const cleanName = originalName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
  return `farm-flow/${siteId}/${category}/${entityId}/${timestamp}-${cleanName}`;
}

// ---------------------------------------------------------------------------
// Opérations S3
// ---------------------------------------------------------------------------

/**
 * Upload un fichier sur le bucket Hetzner.
 *
 * @param key   — Clé S3 du fichier (ex: factures/cmd_01/1736870400000-facture.pdf)
 * @param body  — Contenu du fichier sous forme de Buffer ou ReadableStream
 * @param contentType — Type MIME du fichier
 * @returns URL du fichier (non signée — accès uniquement via getSignedUrl)
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType: string
): Promise<string> {
  const s3 = getS3Client();
  const bucket = getBucket();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // ACL non défini : bucket privé par défaut
    })
  );

  // Retourner la clé (pas une URL publique — accès via signed URL uniquement)
  return key;
}

/**
 * Supprime un fichier du bucket Hetzner.
 *
 * @param key — Clé S3 du fichier à supprimer
 */
export async function deleteFile(key: string): Promise<void> {
  const s3 = getS3Client();
  const bucket = getBucket();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Génère une URL présignée pour accéder à un fichier.
 * L'URL expire après `expiresIn` secondes (défaut : 1 heure).
 *
 * @param key       — Clé S3 du fichier
 * @param expiresIn — Durée de validité en secondes (défaut : 3600)
 * @returns URL présignée valide pour `expiresIn` secondes
 */
export async function getSignedUrl(
  key: string,
  expiresIn: number = SIGNED_URL_EXPIRES_IN
): Promise<string> {
  const s3 = getS3Client();
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return awsGetSignedUrl(s3, command, { expiresIn });
}

/**
 * Extrait le nom de fichier original depuis une clé S3.
 * Ex: "factures/cmd_01/1736870400000-facture.pdf" → "facture.pdf"
 */
export function extractFileNameFromKey(key: string): string {
  const parts = key.split("/");
  const fileName = parts[parts.length - 1];
  // Retirer le préfixe timestamp (ex: "1736870400000-")
  const withoutTimestamp = fileName.replace(/^\d+-/, "");
  return withoutTimestamp;
}
