package com.chatapp.controller;

import com.chatapp.entity.Message;
import com.chatapp.entity.User;
import com.chatapp.repository.ChatMemberRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.security.SecurityUtils;
import com.chatapp.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
@Slf4j
public class FileController {

    private final FileStorageService fileStorageService;
    private final MessageRepository messageRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final SecurityUtils securityUtils;

    /**
     * POST /api/files/upload  (multipart/form-data, field "file")
     * Returns: { url (= object key), name, contentType, size }
     */
    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        securityUtils.getCurrentUser();

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Empty file"));
        }
        if (file.getSize() > 20L * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "File too large (max 20MB)"));
        }

        try {
            FileStorageService.UploadResult result = fileStorageService.upload(file);
            return ResponseEntity.ok(result);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    /**
     * GET /api/files/download?key=<objectKey>
     * verifica ca user-ul are drepturi, adica e membru in chat ul care contine atasamentul
     * si raspunde cu 302 redirect catre un Signed URL proaspat (15 minute).
     * URL-ul de aici e STABIL: poate fi pus in <img src> sau <a href>, iar
     * backend-ul regenereaza link-ul GCS la fiecare cerere.
     */
    @GetMapping("/download")
    public ResponseEntity<?> download(@RequestParam("key") String objectKey) {
        User me = securityUtils.getCurrentUser();
        if (objectKey == null || objectKey.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing key"));
        }

        // securitate: gaseste mesajele care folosesc obiectul si verifica daca user-ul e membru in chat-ul corespunzator. Daca nu, refuza accesul.
        List<Message> refs = messageRepository.findByAttachmentUrlAndDeletedFalse(objectKey);
        boolean allowed = false;
        for (Message m : refs) {
            Long chatId = m.getChat().getId();
            if (chatMemberRepository.existsByChatIdAndUserId(chatId, me.getId())) {
                allowed = true;
                break;
            }
        }
        if (!allowed) {
            log.warn("User {} attempted to access GCS key {} without membership", me.getId(), objectKey);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "No access to this attachment"));
        }

        try {
            String fresh = fileStorageService.generateShortLivedSignedUrl(objectKey);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, fresh)
                    .build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", "Cannot sign URL: " + e.getMessage()));
        }
    }
}
