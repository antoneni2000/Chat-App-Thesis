package com.chatapp.service;

import com.chatapp.entity.Message;
import com.chatapp.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * cleanup conservator:
 *  - NU se sterge nimic vizibil utilizatorului. Mesajele active raman in DB pe termen lung.
 *  - Tombstones (mesaje soft-delete)  hard delete dupa retention-days (default 30).
 *    Si ATASAMENTUL din GCS e sters in acelasi timp (orfan detection redundant, dar safe).
 *  - Orphan attachments in GCS (uploadate dar nelegate de niciun mesaj activ) sterse
 *    dupa 24h, ca sa nu se acumuleze fisiere uitate (drag&drop neutrimis, etc.).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class MessageCleanupService {

    private final MessageRepository messageRepository;
    private final FileStorageService fileStorageService;

    @Value("${app.cleanup.retention-days:30}")
    private int retentionDays;

    /**
     * 02:00 zilnic — sterge HARD din DB mesajele soft-delete vechi de >retentionDays.
     * atasamentele asociate au fost (sau urmeaza sa fie) sterse la orphan detection.
     */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupOldDeletedMessages() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
            log.info("Cleanup: deleting soft-deleted messages older than {} days (cutoff = {})",
                    retentionDays, cutoff);

            // aterge atasamentele din GCS pentru mesajele care AU url stocat
            List<Message> oldDeleted = messageRepository.findOldDeletedMessages(cutoff);
            for (Message m : oldDeleted) {
                String stored = m.getAttachmentUrl();
                if (stored != null && !stored.isBlank()) {
                    // soft-delete poate sa fi sters deja attachmentUrl, dar uneori nu ---  incearca oricum
                    String key = stored.startsWith("http") ? fileStorageService.extractObjectNameFromUrl(stored) : stored;
                    if (key != null) fileStorageService.deleteByKey(key);
                }
            }

            int dbDeleted = messageRepository.deleteOldDeletedMessages(cutoff);
            log.info("Cleanup: removed {} tombstone rows from DB", dbDeleted);
        } catch (Exception e) {
            log.error("Cleanup job failed: {}", e.getMessage(), e);
        }
    }

    /**
     * 03:00 zilnic — detecteaza fisiere din GCS care NU mai sunt referite de niciun
     * mesaj activ si le sterge.
     * Cazul tipic: user-ul a uploadat ceva (drag&drop) dar n-a apasat Send.
     * fisierul exista in bucket dar niciun mesaj nu-l mentioneaza. acumularea costa la GCS.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void detectOrphanAttachments() {
        try {
            log.info("Orphan attachment detection: scanning GCS bucket");

            List<String> allKeys = fileStorageService.listAttachmentKeys();
            if (allKeys.isEmpty()) {
                log.info("Orphan detection: bucket empty / GCS off — skip");
                return;
            }

            // construim setul de keys referite in DB (active sau tombstones).
            // O singura SELECT in loc de un query per fisier.
            Set<String> referenced = new HashSet<>();
            for (String stored : messageRepository.findAllReferencedAttachments()) {
                if (stored == null || stored.isBlank()) continue;
                if (stored.startsWith("http")) {
                    String k = fileStorageService.extractObjectNameFromUrl(stored);
                    if (k != null) referenced.add(k);
                } else {
                    referenced.add(stored);
                }
            }

            int deleted = 0;
            for (String key : allKeys) {
                if (!referenced.contains(key)) {
                    fileStorageService.deleteByKey(key);
                    deleted++;
                }
            }
            log.info("Orphan detection: deleted {} orphan objects (of {} total in bucket, {} referenced)",
                    deleted, allKeys.size(), referenced.size());
        } catch (Exception e) {
            log.error("Orphan detection failed: {}", e.getMessage(), e);
        }
    }

    /**
     * 04:00 zilnic — log stats simple despre dimensiunea DB-ului.
     */
    @Scheduled(cron = "0 0 4 * * *")
    public void logDatabaseStats() {
        try {
            long total = messageRepository.count();
            long tombstones = messageRepository.countTombstones();
            log.info("=== DB STATS === total messages: {} | tombstones (soft-deleted): {} | active: {}",
                    total, tombstones, total - tombstones);
        } catch (Exception e) {
            log.error("Database stats logging failed: {}", e.getMessage(), e);
        }
    }
}
