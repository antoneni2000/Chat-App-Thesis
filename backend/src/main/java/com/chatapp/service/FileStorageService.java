package com.chatapp.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.storage.*;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileInputStream;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Service pentru upload fisiere in Google Cloud Storage (GCS).
 * Genereaza Signed URLs securizate (privat, temporar, sigur).
 * - Bucket-ul trebuie sa fie PRIVAT
 * - Doar cu semnătura validă poți accesa fișierul
 */
@Service
@Slf4j
public class FileStorageService {

    @Value("${app.gcs.project-id}")
    private String projectId;

    @Value("${app.gcs.bucket}")
    private String bucketName;

    @Value("${app.gcs.credentials-path}")
    private String credentialsPath;


    private Storage storage;
    private boolean enabled = false;

    @PostConstruct
    public void init() {
        try {
            if (projectId == null || projectId.startsWith("YOUR_")
                    || bucketName == null || bucketName.startsWith("YOUR_")
                    || credentialsPath == null
                    || !Files.exists(Paths.get(credentialsPath))) {
                log.warn("GCS NOT configured. Attachments upload will fail. " +
                        "Set app.gcs.* in application.properties and place credentials JSON at " + credentialsPath);
                return;
            }

            GoogleCredentials googleCredentials = GoogleCredentials.fromStream(
                    new FileInputStream(credentialsPath));
            storage = StorageOptions.newBuilder()
                    .setProjectId(projectId)
                    .setCredentials(googleCredentials)
                    .build()
                    .getService();
            enabled = true;
            log.info("GCS configured: project={}, bucket={}",
                    projectId, bucketName);
        } catch (Exception e) {
            log.error("Failed to initialize GCS: {}", e.getMessage());
        }
    }

    /**
     * Uploadeaza un fisier in GCS sub prefixul "attachments/" si returneaza object key.
     */
    public UploadResult upload(MultipartFile file) throws IOException {
        return uploadWithPrefix(file, "attachments");
    }

    /**
     * Uploadeaza un avatar in GCS sub prefixul "avatars/" si returneaza object key.
     * Avatarele sunt PUBLIC_READ (nu au nevoie de Signed URL — sunt imagini de profil).
     */
    public String uploadAvatar(MultipartFile file) throws IOException {
        if (!enabled) {
            throw new IllegalStateException("Cloud storage not configured.");
        }
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "avatar";
        String extension = "";
        int dotIdx = originalName.lastIndexOf('.');
        if (dotIdx > 0) extension = originalName.substring(dotIdx);
        String objectName = "avatars/" + UUID.randomUUID() + extension;

        BlobId blobId = BlobId.of(bucketName, objectName);
        BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                .setContentType(file.getContentType())
                .build();
        storage.create(blobInfo, file.getBytes());
        log.info("Uploaded avatar to GCS: {}", objectName);
        return objectName;
    }

    private UploadResult uploadWithPrefix(MultipartFile file, String prefix) throws IOException {
        if (!enabled) {
            throw new IllegalStateException(
                    "Cloud storage not configured. See GCS-Setup.md.");
        }
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String extension = "";
        int dotIdx = originalName.lastIndexOf('.');
        if (dotIdx > 0) extension = originalName.substring(dotIdx);
        String objectName = prefix + "/" + UUID.randomUUID() + extension;

        BlobId blobId = BlobId.of(bucketName, objectName);
        BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                .setContentType(file.getContentType())
                .build();
        storage.create(blobInfo, file.getBytes());
        log.info("Uploaded to GCS (private): {}", objectName);
        // Stocam in DB object key (stabil), nu Signed URL (care expira).
        return new UploadResult(objectName, originalName, file.getContentType(), file.getSize());
    }

    /**
     * Signed URL pe TERMEN SCURT (1 ora) — folosit la fiecare DTO de mesaj,
     * mereu proaspat, nu se stocheaza nicaieri.
     */
    public String generateShortLivedSignedUrl(String objectName) throws IOException {
        if (!enabled) throw new IllegalStateException("Cloud storage not configured");
        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName).build();
        URL signedUrl = storage.signUrl(
                blobInfo, 15, TimeUnit.MINUTES,
                Storage.SignUrlOption.withV4Signature()
        );
        return signedUrl.toString();
    }

    /**
     * Helper care primeste CE E STOCAT in DB (poate fi object key nou
     * "attachments/uuid.ext" SAU un Signed URL vechi "https://...") si returneaza
     * un URL proaspat valid pentru afisare/descarcare.
     * Daca nu poate genera (GCS off / parse failed) intoarce input-ul original.
     */
    public String freshUrlFor(String stored) {
        if (stored == null || stored.isBlank()) return stored;
        String key;
        if (stored.startsWith("http://") || stored.startsWith("https://")) {
            key = extractObjectNameFromUrl(stored);
            if (key == null) return stored; // URL strain (ex. avatar Google) — lasa-l in pace
        } else {
            key = stored;
        }
        try {
            return generateShortLivedSignedUrl(key);
        } catch (Exception e) {
            log.warn("Cannot sign URL for key {}: {}", key, e.getMessage());
            return stored;
        }
    }

    /**
     * Listeaza toate object-urile sub "attachments/" — pentru orphan detection.
     */
    public java.util.List<String> listAttachmentKeys() {
        if (!enabled) return java.util.Collections.emptyList();
        java.util.List<String> keys = new java.util.ArrayList<>();
        for (Blob b : storage.list(bucketName, Storage.BlobListOption.prefix("attachments/")).iterateAll()) {
            keys.add(b.getName());
        }
        return keys;
    }

    /**
     * Sterge un object direct dupa key.
     */
    public void deleteByKey(String objectKey) {
        if (!enabled || objectKey == null || objectKey.isBlank()) return;
        try {
            storage.delete(BlobId.of(bucketName, objectKey));
            log.info("Deleted from GCS by key: {}", objectKey);
        } catch (Exception e) {
            log.warn("Failed to delete GCS object {}: {}", objectKey, e.getMessage());
        }
    }

    /**
     * Backward-compat: sterge un fisier din GCS dupa URL (Signed URL veche).
     */
    public void delete(String url) {
        if (!enabled || url == null) return;
        try {
            String objectName = extractObjectNameFromUrl(url);
            if (objectName != null && !objectName.isEmpty()) {
                storage.delete(BlobId.of(bucketName, objectName));
                log.info("Deleted from GCS: {}", objectName);
            }
        } catch (Exception e) {
            log.warn("Failed to delete from GCS: {}", e.getMessage());
        }
    }

    /**
     * Extrage object name din Signed URL sau public URL.
     * Signed URLs sunt complexe cu query parameters, asa ca extracts din path.
     */
    public String extractObjectNameFromUrl(String url) {
        // Signed URLs: https://storage.googleapis.com/bucket/object?signature...
        // Public URLs: https://storage.googleapis.com/bucket/object
        String prefix = "https://storage.googleapis.com/" + bucketName + "/";
        if (url.startsWith(prefix)) {
            String path = url.substring(prefix.length());
            // Sterge query parameters (signature si alti parametri)
            int questionMark = path.indexOf('?');
            if (questionMark > 0) {
                return path.substring(0, questionMark);
            }
            return path;
        }
        return null;
    }

    /**
     * Record pentru a returna detaliile upload-ului.
     */
    public record UploadResult(String url, String name, String contentType, long size) {}
}
